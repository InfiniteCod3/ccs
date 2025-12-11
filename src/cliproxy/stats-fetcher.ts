/**
 * CLIProxyAPI Stats Fetcher
 *
 * Fetches usage statistics from CLIProxyAPI's management API.
 * Requires usage-statistics-enabled: true in config.yaml.
 */

import { CLIPROXY_DEFAULT_PORT } from './config-generator';

/** Usage statistics from CLIProxyAPI */
export interface ClipproxyStats {
  /** Total number of requests processed */
  totalRequests: number;
  /** Token counts */
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  /** Requests grouped by model */
  requestsByModel: Record<string, number>;
  /** Requests grouped by provider */
  requestsByProvider: Record<string, number>;
  /** Number of quota exceeded (429) events */
  quotaExceededCount: number;
  /** Number of request retries */
  retryCount: number;
  /** Timestamp of stats collection */
  collectedAt: string;
}

/** Stats API response from CLIProxyAPI */
interface StatsApiResponse {
  total_requests?: number;
  tokens?: {
    input?: number;
    output?: number;
  };
  requests_by_model?: Record<string, number>;
  requests_by_provider?: Record<string, number>;
  quota_exceeded_count?: number;
  retry_count?: number;
}

/**
 * Fetch usage statistics from CLIProxyAPI management API
 * @param port CLIProxyAPI port (default: 8317)
 * @returns Stats object or null if unavailable
 */
export async function fetchClipproxyStats(
  port: number = CLIPROXY_DEFAULT_PORT
): Promise<ClipproxyStats | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const response = await fetch(`http://127.0.0.1:${port}/v0/management/stats`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as StatsApiResponse;

    // Normalize the response to our interface
    return {
      totalRequests: data.total_requests ?? 0,
      tokens: {
        input: data.tokens?.input ?? 0,
        output: data.tokens?.output ?? 0,
        total: (data.tokens?.input ?? 0) + (data.tokens?.output ?? 0),
      },
      requestsByModel: data.requests_by_model ?? {},
      requestsByProvider: data.requests_by_provider ?? {},
      quotaExceededCount: data.quota_exceeded_count ?? 0,
      retryCount: data.retry_count ?? 0,
      collectedAt: new Date().toISOString(),
    };
  } catch {
    // CLIProxyAPI not running or stats endpoint not available
    return null;
  }
}

/**
 * Check if CLIProxyAPI is running and responsive
 * @param port CLIProxyAPI port (default: 8317)
 * @returns true if proxy is running
 */
export async function isClipproxyRunning(
  port: number = CLIPROXY_DEFAULT_PORT
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1s timeout

    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
