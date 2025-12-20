/**
 * Utility functions for Profile Editor
 */

/** Check if a key is considered sensitive (API keys, tokens, etc.) */
export function isSensitiveKey(key: string): boolean {
  const sensitivePatterns = [
    /^ANTHROPIC_AUTH_TOKEN$/,
    /_API_KEY$/,
    /_AUTH_TOKEN$/,
    /^API_KEY$/,
    /^AUTH_TOKEN$/,
    /_SECRET$/,
    /^SECRET$/,
  ];
  return sensitivePatterns.some((pattern) => pattern.test(key));
}
