/**
 * CLIProxy Stats Card Component
 *
 * Displays CLIProxyAPI usage statistics including:
 * - Proxy status (running/stopped)
 * - Total requests
 * - Quota exceeded events
 * - Request retries
 * - Requests by provider
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, AlertTriangle, RefreshCw, Server, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClipproxyStats, useClipproxyStatus } from '@/hooks/use-cliproxy-stats';

interface ClipproxyStatsCardProps {
  className?: string;
}

export function ClipproxyStatsCard({ className }: ClipproxyStatsCardProps) {
  const { data: status, isLoading: statusLoading } = useClipproxyStatus();
  const { data: stats, isLoading: statsLoading, error } = useClipproxyStats(status?.running);

  const isLoading = statusLoading || (status?.running && statsLoading);

  if (isLoading) {
    return (
      <Card className={cn('flex flex-col h-full', className)}>
        <CardHeader className="px-3 py-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Server className="h-4 w-4" />
            CLIProxy Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 flex-1">
          <div className="space-y-3">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Proxy not running
  if (!status?.running) {
    return (
      <Card className={cn('flex flex-col h-full border-dashed', className)}>
        <CardHeader className="px-3 py-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              CLIProxy Stats
            </CardTitle>
            <Badge variant="secondary" className="text-[10px] h-5">
              Offline
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground text-center">
            Start a CLIProxy session (gemini, codex, agy) to collect stats.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Error fetching stats
  if (error) {
    return (
      <Card className={cn('flex flex-col h-full border-destructive/50', className)}>
        <CardHeader className="px-3 py-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Server className="h-4 w-4" />
              CLIProxy Stats
            </CardTitle>
            <Badge variant="destructive" className="text-[10px] h-5">
              Error
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 flex-1">
          <p className="text-xs text-destructive">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  // Stats available
  const statItems = [
    {
      label: 'Requests',
      value: stats?.totalRequests ?? 0,
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      label: 'Quota',
      value: stats?.quotaExceededCount ?? 0,
      icon: AlertTriangle,
      color: stats?.quotaExceededCount ? 'text-amber-600' : 'text-muted-foreground',
      bgColor:
        stats?.quotaExceededCount
          ? 'bg-amber-100 dark:bg-amber-900/20'
          : 'bg-muted',
    },
    {
      label: 'Retries',
      value: stats?.retryCount ?? 0,
      icon: RefreshCw,
      color: stats?.retryCount ? 'text-orange-600' : 'text-muted-foreground',
      bgColor:
        stats?.retryCount ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-muted',
    },
  ];

  // Provider breakdown
  const providers = Object.entries(stats?.requestsByProvider ?? {}).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <Card className={cn('flex flex-col h-full overflow-hidden', className)}>
      <CardHeader className="px-3 py-2 border-b bg-muted/5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Server className="h-4 w-4" />
            CLIProxy Stats
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] h-5 text-green-600 border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800"
          >
            <Zap className="h-3 w-3 mr-0.5" />
            Running
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-3">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {statItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex flex-col items-center p-2 rounded-lg bg-muted/50"
                  >
                    <div className={cn('p-1 rounded-md mb-1', item.bgColor)}>
                      <Icon className={cn('h-3 w-3', item.color)} />
                    </div>
                    <span className="text-sm font-bold">{item.value}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Provider breakdown */}
            {providers.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">
                  By Provider
                </p>
                <div className="flex flex-wrap gap-1">
                  {providers.map(([provider, count]) => (
                    <Badge key={provider} variant="outline" className="text-[10px] h-5 px-1.5">
                      {provider}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tokens */}
            {stats?.tokens && stats.tokens.total > 0 && (
              <div className="text-[10px] text-muted-foreground">
                Tokens: {formatNumber(stats.tokens.input)} in /{' '}
                {formatNumber(stats.tokens.output)} out
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}
