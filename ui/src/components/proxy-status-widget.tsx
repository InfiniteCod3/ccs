/**
 * Proxy Status Widget
 *
 * Displays CLIProxy process status with start button for recovery.
 * Shows: running state, port, session count, uptime.
 */

import { Activity, Power, RefreshCw, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProxyStatus, useStartProxy } from '@/hooks/use-cliproxy';
import { cn } from '@/lib/utils';

function formatUptime(startedAt?: string): string {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diff = now - start;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function ProxyStatusWidget() {
  const { data: status, isLoading } = useProxyStatus();
  const startProxy = useStartProxy();

  const isRunning = status?.running ?? false;

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        isRunning ? 'border-green-500/30 bg-green-500/5' : 'border-muted bg-muted/30'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isRunning ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'
            )}
          />
          <span className="text-sm font-medium">CLIProxy Service</span>
        </div>

        <div className="flex items-center gap-1">
          {isLoading ? (
            <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : isRunning ? (
            <Activity className="w-3 h-3 text-green-600" />
          ) : (
            <Power className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
      </div>

      {isRunning && status ? (
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">Port {status.port}</span>
          {status.sessionCount !== undefined && status.sessionCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {status.sessionCount} session{status.sessionCount !== 1 ? 's' : ''}
            </span>
          )}
          {status.startedAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatUptime(status.startedAt)}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Not running</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => startProxy.mutate()}
            disabled={startProxy.isPending}
          >
            {startProxy.isPending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Power className="w-3 h-3" />
            )}
            Start
          </Button>
        </div>
      )}
    </div>
  );
}
