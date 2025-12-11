/**
 * React Query hook for CLIProxyAPI stats
 */

import { useQuery } from '@tanstack/react-query';

/** CLIProxy usage statistics */
export interface ClipproxyStats {
  totalRequests: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  requestsByModel: Record<string, number>;
  requestsByProvider: Record<string, number>;
  quotaExceededCount: number;
  retryCount: number;
  collectedAt: string;
}

/** CLIProxy running status */
export interface ClipproxyStatus {
  running: boolean;
}

/**
 * Fetch CLIProxy stats from API
 */
async function fetchClipproxyStats(): Promise<ClipproxyStats> {
  const response = await fetch('/api/cliproxy/stats');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch stats');
  }
  return response.json();
}

/**
 * Fetch CLIProxy running status
 */
async function fetchClipproxyStatus(): Promise<ClipproxyStatus> {
  const response = await fetch('/api/cliproxy/status');
  if (!response.ok) {
    throw new Error('Failed to fetch status');
  }
  return response.json();
}

/**
 * Hook to get CLIProxy running status
 */
export function useClipproxyStatus() {
  return useQuery({
    queryKey: ['cliproxy-status'],
    queryFn: fetchClipproxyStatus,
    refetchInterval: 10000, // Check every 10 seconds
    retry: 1,
  });
}

/**
 * Hook to get CLIProxy usage stats
 */
export function useClipproxyStats(enabled = true) {
  return useQuery({
    queryKey: ['cliproxy-stats'],
    queryFn: fetchClipproxyStats,
    enabled,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1,
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}
