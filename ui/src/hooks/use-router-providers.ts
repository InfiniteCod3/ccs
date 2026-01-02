/**
 * Router Providers Hook - Fetch providers with health status
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

/**
 * Fetch all providers with health status
 * Auto-refreshes every 30 seconds
 */
export function useRouterProviders() {
  return useQuery({
    queryKey: ['router', 'providers'],
    queryFn: () => api.router.providers.list(),
    refetchInterval: 30000, // Refresh health every 30s
  });
}
