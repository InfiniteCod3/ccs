#!/usr/bin/env node
/**
 * CCS WebSearch Hook - CLI Tool Executor with Fallback Chain
 *
 * Intercepts Claude's WebSearch tool and executes search via CLI tools.
 * Supports automatic fallback: Gemini CLI → OpenCode → Grok CLI
 *
 * Environment Variables (set by CCS):
 *   CCS_WEBSEARCH_SKIP=1       - Skip this hook entirely (for official Claude)
 *   CCS_WEBSEARCH_ENABLED=1    - Enable WebSearch (default: 1)
 *   CCS_WEBSEARCH_TIMEOUT=55   - Timeout in seconds (default: 55)
 *   CCS_DEBUG=1                - Enable debug output
 *
 * Exit codes:
 *   0 - Allow tool (pass-through to native WebSearch)
 *   2 - Block tool (deny with results/message)
 *
 * @module hooks/websearch-transformer
 */

const { spawnSync } = require('child_process');

// Minimum response length to consider valid
const MIN_VALID_RESPONSE_LENGTH = 20;

// Default timeout in seconds
const DEFAULT_TIMEOUT_SEC = 55;

// Read input from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  processHook();
});

// Handle stdin not being available
process.stdin.on('error', () => {
  process.exit(0);
});

/**
 * Check if a CLI tool is available
 */
function isCliAvailable(cmd) {
  try {
    const result = spawnSync('which', [cmd], {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.status === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Main hook processing logic with fallback chain
 */
async function processHook() {
  try {
    // Skip if disabled (for official Claude subscriptions)
    if (process.env.CCS_WEBSEARCH_SKIP === '1') {
      process.exit(0);
    }

    // Check if enabled (default: enabled)
    if (process.env.CCS_WEBSEARCH_ENABLED === '0') {
      process.exit(0);
    }

    const data = JSON.parse(input);

    // Only handle WebSearch tool
    if (data.tool_name !== 'WebSearch') {
      process.exit(0);
    }

    const query = data.tool_input?.query || '';

    if (!query) {
      process.exit(0);
    }

    const timeout = parseInt(process.env.CCS_WEBSEARCH_TIMEOUT || DEFAULT_TIMEOUT_SEC, 10);

    // Fallback chain: Gemini → OpenCode → Grok
    const providers = [
      { name: 'Gemini CLI', cmd: 'gemini', fn: tryGeminiSearch },
      { name: 'OpenCode', cmd: 'opencode', fn: tryOpenCodeSearch },
      { name: 'Grok CLI', cmd: 'grok', fn: tryGrokSearch },
    ];

    const availableProviders = providers.filter((p) => isCliAvailable(p.cmd));
    const errors = [];

    if (process.env.CCS_DEBUG) {
      const available = availableProviders.map((p) => p.name).join(', ') || 'none';
      console.error(`[CCS Hook] Available providers: ${available}`);
    }

    // Try each available provider in order
    for (const provider of availableProviders) {
      if (process.env.CCS_DEBUG) {
        console.error(`[CCS Hook] Trying ${provider.name}...`);
      }

      const result = provider.fn(query, timeout);

      if (result.success) {
        outputSuccess(query, result.content, provider.name);
        return;
      }

      if (process.env.CCS_DEBUG) {
        console.error(`[CCS Hook] ${provider.name} failed: ${result.error}`);
      }

      errors.push({ provider: provider.name, error: result.error });
    }

    // All providers failed or none available
    if (availableProviders.length === 0) {
      outputNoToolsMessage(query);
    } else {
      outputAllFailedMessage(query, errors);
    }
  } catch (err) {
    if (process.env.CCS_DEBUG) {
      console.error('[CCS Hook] Parse error:', err.message);
    }
    process.exit(0);
  }
}

/**
 * Execute search via Gemini CLI
 */
function tryGeminiSearch(query, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  try {
    const timeoutMs = timeoutSec * 1000;

    const prompt = [
      `Search the web for: ${query}`,
      '',
      'Instructions:',
      '1. Use the google_web_search tool to find current information',
      '2. Provide a comprehensive summary of the search results',
      '3. Include relevant URLs/sources when available',
      '4. Be concise but thorough',
      '5. Focus on factual, up-to-date information',
    ].join('\n');

    if (process.env.CCS_DEBUG) {
      console.error('[CCS Hook] Executing: gemini --model gemini-2.5-flash --yolo -p "..."');
    }

    const spawnResult = spawnSync(
      'gemini',
      ['--model', 'gemini-2.5-flash', '--yolo', '-p', prompt],
      {
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 2,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    if (spawnResult.error) {
      if (spawnResult.error.code === 'ENOENT') {
        return { success: false, error: 'Gemini CLI not installed' };
      }
      throw spawnResult.error;
    }

    if (spawnResult.status !== 0) {
      const stderr = (spawnResult.stderr || '').trim();
      return {
        success: false,
        error: stderr || `Gemini CLI exited with code ${spawnResult.status}`,
      };
    }

    const result = (spawnResult.stdout || '').trim();

    if (!result || result.length < MIN_VALID_RESPONSE_LENGTH) {
      return { success: false, error: 'Empty or too short response from Gemini' };
    }

    const lowerResult = result.toLowerCase();
    if (
      lowerResult.includes('error:') ||
      lowerResult.includes('failed to') ||
      lowerResult.includes('authentication required')
    ) {
      return { success: false, error: `Gemini returned error: ${result.substring(0, 100)}` };
    }

    return { success: true, content: result };
  } catch (err) {
    if (err.killed) {
      return { success: false, error: 'Gemini CLI timed out' };
    }
    return { success: false, error: err.message || 'Unknown Gemini error' };
  }
}

/**
 * Execute search via OpenCode CLI
 * Uses opencode run with gpt-5-nano model for web search
 */
function tryOpenCodeSearch(query, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  try {
    const timeoutMs = timeoutSec * 1000;

    const prompt = `Search the web for: ${query}

Provide a comprehensive summary with relevant URLs/sources.`;

    if (process.env.CCS_DEBUG) {
      console.error('[CCS Hook] Executing: opencode run --model opencode/gpt-5-nano "..."');
    }

    const spawnResult = spawnSync(
      'opencode',
      ['run', prompt, '--model', 'opencode/gpt-5-nano'],
      {
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 2,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    if (spawnResult.error) {
      if (spawnResult.error.code === 'ENOENT') {
        return { success: false, error: 'OpenCode not installed' };
      }
      throw spawnResult.error;
    }

    if (spawnResult.status !== 0) {
      const stderr = (spawnResult.stderr || '').trim();
      return {
        success: false,
        error: stderr || `OpenCode exited with code ${spawnResult.status}`,
      };
    }

    const result = (spawnResult.stdout || '').trim();

    if (!result || result.length < MIN_VALID_RESPONSE_LENGTH) {
      return { success: false, error: 'Empty or too short response from OpenCode' };
    }

    const lowerResult = result.toLowerCase();
    if (
      lowerResult.includes('error:') ||
      lowerResult.includes('failed to') ||
      lowerResult.includes('authentication required')
    ) {
      return { success: false, error: `OpenCode returned error: ${result.substring(0, 100)}` };
    }

    return { success: true, content: result };
  } catch (err) {
    if (err.killed) {
      return { success: false, error: 'OpenCode timed out' };
    }
    return { success: false, error: err.message || 'Unknown OpenCode error' };
  }
}

/**
 * Execute search via Grok CLI
 * Uses grok command for web search (requires GROK_API_KEY)
 */
function tryGrokSearch(query, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  try {
    const timeoutMs = timeoutSec * 1000;

    const prompt = `Search the web for: ${query}

Provide a comprehensive summary with relevant URLs/sources.`;

    if (process.env.CCS_DEBUG) {
      console.error('[CCS Hook] Executing: grok "..."');
    }

    const spawnResult = spawnSync('grok', [prompt], {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 2,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (spawnResult.error) {
      if (spawnResult.error.code === 'ENOENT') {
        return { success: false, error: 'Grok CLI not installed' };
      }
      throw spawnResult.error;
    }

    if (spawnResult.status !== 0) {
      const stderr = (spawnResult.stderr || '').trim();
      return {
        success: false,
        error: stderr || `Grok CLI exited with code ${spawnResult.status}`,
      };
    }

    const result = (spawnResult.stdout || '').trim();

    if (!result || result.length < MIN_VALID_RESPONSE_LENGTH) {
      return { success: false, error: 'Empty or too short response from Grok' };
    }

    const lowerResult = result.toLowerCase();
    if (
      lowerResult.includes('error:') ||
      lowerResult.includes('failed to') ||
      lowerResult.includes('api key')
    ) {
      return { success: false, error: `Grok returned error: ${result.substring(0, 100)}` };
    }

    return { success: true, content: result };
  } catch (err) {
    if (err.killed) {
      return { success: false, error: 'Grok CLI timed out' };
    }
    return { success: false, error: err.message || 'Unknown Grok error' };
  }
}

/**
 * Format search results for Claude
 */
function formatSearchResults(query, content, providerName) {
  return [
    '=== WEBSEARCH COMPLETED SUCCESSFULLY ===',
    `(via ${providerName} - this is NOT an error)`,
    '',
    `Query: "${query}"`,
    '',
    content,
    '',
    '=========================================',
    'Use this information to answer the user. Search again if needed.',
  ].join('\n');
}

/**
 * Output success response and exit
 */
function outputSuccess(query, content, providerName) {
  const output = {
    decision: 'block',
    reason: `WebSearch completed via ${providerName}`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: formatSearchResults(query, content, providerName),
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Output error message
 */
function outputError(query, error, providerName) {
  const message = [
    `[WebSearch - ${providerName} Error]`,
    '',
    `Error: ${error}`,
    '',
    `Query: "${query}"`,
    '',
    'Troubleshooting:',
    '  - Check if Gemini CLI is authenticated: gemini auth status',
    '  - Re-authenticate if needed: gemini auth login',
  ].join('\n');

  const output = {
    decision: 'block',
    reason: `WebSearch failed: ${error}`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: message,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Output no tools message
 */
function outputNoToolsMessage(query) {
  const message = [
    '[WebSearch - No CLI Tools Available]',
    '',
    'WebSearch requires a CLI tool to be installed.',
    '',
    'Install one of the following (in order of preference):',
    '',
    '1. Gemini CLI (FREE, 1000 req/day):',
    '   npm install -g @google/gemini-cli',
    '   gemini auth login',
    '',
    '2. OpenCode (FREE via Zen):',
    '   curl -fsSL https://opencode.ai/install | bash',
    '',
    '3. Grok CLI (requires XAI_API_KEY):',
    '   npm install -g @vibe-kit/grok-cli',
    '',
    `Query: "${query}"`,
  ].join('\n');

  const output = {
    decision: 'block',
    reason: 'WebSearch unavailable - no CLI tools installed',
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: message,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}

/**
 * Output all providers failed message
 */
function outputAllFailedMessage(query, errors) {
  const errorDetails = errors
    .map((e) => `  - ${e.provider}: ${e.error}`)
    .join('\n');

  const message = [
    '[WebSearch - All Providers Failed]',
    '',
    'Tried all available CLI tools but all failed:',
    errorDetails,
    '',
    `Query: "${query}"`,
    '',
    'Troubleshooting:',
    '  - Gemini: gemini auth status / gemini auth login',
    '  - OpenCode: opencode --version',
    '  - Grok: Check XAI_API_KEY environment variable',
  ].join('\n');

  const output = {
    decision: 'block',
    reason: 'WebSearch failed - all providers failed',
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: message,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}
