/**
 * AgyProxy - Response proxy for Antigravity model ID normalization
 *
 * Architecture:
 * - Sits between Claude Code and CLIProxyAPI
 * - Forwards requests unchanged to upstream
 * - Intercepts responses and normalizes model IDs in message_start events
 * - Fixes MCP tool failures caused by invalid model IDs
 *
 * Lifecycle:
 * - Spawned by cliproxy-executor when 'agy' provider detected
 * - Binds to 127.0.0.1:random_port (security + avoid conflicts)
 * - Terminates when parent process exits
 */

import * as http from 'http';
import * as https from 'https';

import { normalizeModelId } from './model-normalizer';

interface AgyProxyConfig {
  upstreamUrl: string;
  verbose?: boolean;
  timeout?: number;
}

export class AgyProxy {
  private upstreamUrl: string;
  private server: http.Server | null = null;
  private port: number | null = null;
  private verbose: boolean;
  private timeout: number;

  constructor(config: AgyProxyConfig) {
    this.upstreamUrl = config.upstreamUrl;
    this.verbose = config.verbose || false;
    this.timeout = config.timeout || 120000;
  }

  /**
   * Start HTTP server on random port
   */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address();
        this.port = typeof address === 'object' && address ? address.port : 0;
        console.log(`PROXY_READY:${this.port}`);

        if (this.verbose) {
          console.error(
            `[agy-proxy] Listening on port ${this.port}, forwarding to ${this.upstreamUrl}`
          );
        }

        resolve(this.port);
      });

      this.server.on('error', (error) => {
        console.error('[agy-proxy] Server error:', error);
        reject(error);
      });
    });
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = Date.now();
    this.log(`Request: ${req.method} ${req.url}`);
    this.log(`Request headers: ${JSON.stringify(req.headers)}`);

    try {
      // Read request body
      let body = await this.readBody(req);

      // Transform request body to strip unsupported fields
      const transformedBody = this.transformRequestBody(body);

      // Determine if streaming based on Accept header or request body
      const isStreaming =
        req.headers.accept?.includes('text/event-stream') ||
        (body && body.includes('"stream":true'));

      // Forward request to upstream
      const upstreamUrl = new URL(req.url || '/', this.upstreamUrl);
      this.log(`Upstream URL: ${upstreamUrl.href}`);
      this.log(`Upstream path: ${upstreamUrl.pathname + upstreamUrl.search}`);
      const isHttps = upstreamUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      // Update content-length if body was transformed
      const headers = { ...req.headers, host: upstreamUrl.host };
      if (transformedBody !== body) {
        headers['content-length'] = Buffer.byteLength(transformedBody).toString();
      }

      const upstreamReq = httpModule.request(
        {
          hostname: upstreamUrl.hostname,
          port: upstreamUrl.port || (isHttps ? 443 : 80),
          path: upstreamUrl.pathname + upstreamUrl.search,
          method: req.method,
          headers,
          // Allow self-signed certs for remote proxy (common in dev environments)
          ...(isHttps ? { rejectUnauthorized: false } : {}),
        },
        (upstreamRes) => {
          if (isStreaming) {
            this.handleStreamingResponse(upstreamRes, res, startTime);
          } else {
            this.handleBufferedResponse(upstreamRes, res, startTime);
          }
        }
      );

      upstreamReq.on('error', (error) => {
        this.log(`Upstream error: ${error.message}`);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { type: 'proxy_error', message: error.message } }));
        }
      });

      // Set timeout
      upstreamReq.setTimeout(this.timeout, () => {
        upstreamReq.destroy();
        if (!res.headersSent) {
          res.writeHead(504, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { type: 'timeout_error', message: 'Request timeout' } }));
        }
      });

      if (transformedBody) {
        upstreamReq.write(transformedBody);
      }
      upstreamReq.end();
    } catch (error) {
      const err = error as Error;
      this.log(`Request error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'proxy_error', message: err.message } }));
      }
    }
  }

  /**
   * Transform request body to strip fields unsupported by Antigravity/Gemini.
   * - Removes cache_control from thinking content blocks (causes 400 error)
   */
  private transformRequestBody(body: string): string {
    if (!body) return body;

    try {
      const data = JSON.parse(body);

      // Transform messages array if present
      if (Array.isArray(data.messages)) {
        let modified = false;
        for (const message of data.messages) {
          if (Array.isArray(message.content)) {
            for (const block of message.content) {
              // Strip cache_control from thinking blocks
              if (block.type === 'thinking' && block.cache_control !== undefined) {
                delete block.cache_control;
                modified = true;
              }
            }
          }
        }
        if (modified) {
          this.log('Stripped cache_control from thinking blocks');
          return JSON.stringify(data);
        }
      }

      return body;
    } catch {
      // JSON parse failed, pass through unchanged
      return body;
    }
  }

  /**
   * Handle streaming SSE response - transform model IDs in message_start events
   */
  private handleStreamingResponse(
    upstreamRes: http.IncomingMessage,
    clientRes: http.ServerResponse,
    startTime: number
  ): void {
    // Forward headers
    const headers: Record<string, string | string[] | undefined> = { ...upstreamRes.headers };
    clientRes.writeHead(upstreamRes.statusCode || 200, headers);

    // Disable Nagle for immediate flush
    if (clientRes.socket) {
      clientRes.socket.setNoDelay(true);
    }

    let buffer = '';

    upstreamRes.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      buffer += data;

      // Process complete SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const transformed = this.transformSSELine(line);
        clientRes.write(transformed + '\n');
      }
    });

    upstreamRes.on('end', () => {
      // Flush remaining buffer
      if (buffer) {
        const transformed = this.transformSSELine(buffer);
        clientRes.write(transformed);
      }
      clientRes.end();
      const duration = Date.now() - startTime;
      this.log(`Streaming completed in ${duration}ms`);
    });

    upstreamRes.on('error', (error) => {
      this.log(`Upstream stream error: ${error.message}`);
      clientRes.end();
    });
  }

  /**
   * Handle buffered (non-streaming) response - transform model ID in JSON
   */
  private handleBufferedResponse(
    upstreamRes: http.IncomingMessage,
    clientRes: http.ServerResponse,
    startTime: number
  ): void {
    const chunks: Buffer[] = [];

    upstreamRes.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    upstreamRes.on('end', () => {
      const body = Buffer.concat(chunks).toString();

      try {
        const data = JSON.parse(body);

        // Transform model field in response
        if (data.model) {
          const originalModel = data.model;
          data.model = normalizeModelId(data.model);
          if (originalModel !== data.model) {
            this.log(`Normalized model: ${originalModel} -> ${data.model}`);
          }
        }

        const transformed = JSON.stringify(data);
        const headers: Record<string, string | string[] | undefined> = { ...upstreamRes.headers };
        headers['content-length'] = Buffer.byteLength(transformed).toString();
        clientRes.writeHead(upstreamRes.statusCode || 200, headers);
        clientRes.end(transformed);
      } catch {
        // JSON parse failed, pass through unchanged
        clientRes.writeHead(upstreamRes.statusCode || 200, upstreamRes.headers);
        clientRes.end(body);
      }

      const duration = Date.now() - startTime;
      this.log(`Buffered response completed in ${duration}ms`);
    });

    upstreamRes.on('error', (error) => {
      this.log(`Upstream error: ${error.message}`);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({ error: { type: 'proxy_error', message: error.message } }));
      }
    });
  }

  /**
   * Transform a single SSE line - normalize model ID in message_start events
   */
  private transformSSELine(line: string): string {
    if (!line.startsWith('data: ')) {
      return line;
    }

    const jsonStr = line.slice(6);
    if (!jsonStr || jsonStr === '[DONE]') {
      return line;
    }

    try {
      const data = JSON.parse(jsonStr);

      // Transform model in message_start event
      if (data.type === 'message_start' && data.message?.model) {
        const originalModel = data.message.model;
        data.message.model = normalizeModelId(data.message.model);
        if (originalModel !== data.message.model) {
          this.log(`Normalized SSE model: ${originalModel} -> ${data.message.model}`);
        }
        return 'data: ' + JSON.stringify(data);
      }

      return line;
    } catch {
      // JSON parse failed, pass through unchanged (validated decision: safe fallback)
      return line;
    }
  }

  /**
   * Read request body with size limit
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const maxSize = 10 * 1024 * 1024; // 10MB limit
      let totalSize = 0;

      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          reject(new Error('Request body too large (max 10MB)'));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
  }

  /**
   * Stop proxy server
   */
  stop(): void {
    if (this.server) {
      this.log('Stopping proxy server');
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Get the port the proxy is listening on
   */
  getPort(): number | null {
    return this.port;
  }

  /**
   * Log message if verbose mode enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.error(`[agy-proxy] ${message}`);
    }
  }
}

// Main entry point for standalone execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const upstreamUrl = process.env.AGY_UPSTREAM_URL || 'http://127.0.0.1:8317/api/provider/agy';

  const proxy = new AgyProxy({ upstreamUrl, verbose });

  proxy.start().catch((error) => {
    console.error('[agy-proxy] Failed to start:', error);
    process.exit(1);
  });

  // Cleanup on signals
  process.on('SIGTERM', () => {
    proxy.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    proxy.stop();
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    console.error('[agy-proxy] Uncaught exception:', error);
    proxy.stop();
    process.exit(1);
  });
}

export default AgyProxy;
