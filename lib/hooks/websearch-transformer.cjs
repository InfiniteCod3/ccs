#!/usr/bin/env node
/**
 * CCS WebSearch Hook - CLI Tool Executor
 *
 * Intercepts Claude's WebSearch tool and executes search via CLI tools.
 * Currently supports Gemini CLI, designed for easy addition of future tools.
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
 * @module hooks/websearch-gemini-transformer
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
 * Main hook processing logic
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

    // Try Gemini CLI (currently the only supported CLI tool)
    if (isCliAvailable('gemini')) {
      if (process.env.CCS_DEBUG) {
        console.error('[CCS Hook] Executing Gemini CLI...');
      }

      const result = tryGeminiSearch(query, timeout);

      if (result.success) {
        outputSuccess(query, result.content, 'Gemini CLI');
        return;
      }

      if (process.env.CCS_DEBUG) {
        console.error(`[CCS Hook] Gemini failed: ${result.error}`);
      }

      // Gemini failed - show error message
      outputError(query, result.error, 'Gemini CLI');
      return;
    }

    // No CLI tools available
    outputNoToolsMessage(query);
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
    'Install Gemini CLI (free, uses Google OAuth):',
    '  npm install -g @google/gemini-cli',
    '  gemini auth login',
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
