/**
 * Proxy Status Widget
 *
 * Displays CLIProxy process status with start/stop/restart controls.
 * Shows: running state, port, session count, uptime, update availability.
 * In remote mode: shows remote server info instead of local controls.
 */

import {
  Activity,
  Power,
  RefreshCw,
  Clock,
  Users,
  Square,
  RotateCw,
  ArrowUp,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { api, type CliproxyServerConfig } from '@/lib/api-client';
import {
  useProxyStatus,
  useStartProxy,
  useStopProxy,
  useCliproxyUpdateCheck,
} from '@/hooks/use-cliproxy';
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

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${hours}h ago`;
}

export function ProxyStatusWidget() {
  const { data: status, isLoading } = useProxyStatus();
  const { data: updateCheck } = useCliproxyUpdateCheck();
  const startProxy = useStartProxy();
  const stopProxy = useStopProxy();

  // Fetch cliproxy_server config for remote mode detection
  const { data: cliproxyConfig } = useQuery<CliproxyServerConfig>({
    queryKey: ['cliproxy-server-config'],
    queryFn: () => api.cliproxyServer.get(),
    staleTime: 30000, // 30 seconds
  });

  // Determine if remote mode is enabled
  const remoteConfig = cliproxyConfig?.remote;
  const isRemoteMode = remoteConfig?.enabled && remoteConfig?.host;

  const isRunning = status?.running ?? false;
  const isActioning = startProxy.isPending || stopProxy.isPending;
  const hasUpdate = updateCheck?.hasUpdate ?? false;

  // Build remote display info
  const remoteDisplayHost = isRemoteMode
    ? (() => {
        const protocol = remoteConfig.protocol || 'http';
        const port = remoteConfig.port || (protocol === 'https' ? 443 : 80);
        const isDefaultPort =
          (protocol === 'https' && port === 443) || (protocol === 'http' && port === 80);
        return isDefaultPort ? remoteConfig.host : `${remoteConfig.host}:${port}`;
      })()
    : null;

  // Restart = stop then start
  const handleRestart = async () => {
    await stopProxy.mutateAsync();
    // Small delay to ensure port is released
    await new Promise((r) => setTimeout(r, 500));
    startProxy.mutate();
  };

  // Remote mode: show remote server info
  if (isRemoteMode) {
    return (
      <div
        className={cn(
          'rounded-lg border p-3 transition-colors',
          'border-blue-500/30 bg-blue-500/5'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">Remote Proxy</span>
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            >
              Active
            </Badge>
          </div>
          <Activity className="w-3 h-3 text-blue-600" />
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 mb-1">
            <span className="font-mono">{remoteDisplayHost}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70 leading-tight">
            Traffic auto-routed to remote server
          </p>
        </div>
      </div>
    );
  }

  // Local mode: show original controls

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
          {hasUpdate && (
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1.5 gap-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              title={`Update: v${updateCheck?.currentVersion} -> v${updateCheck?.latestVersion}`}
            >
              <ArrowUp className="w-2.5 h-2.5" />
              Update
            </Badge>
          )}
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
        <>
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
          {/* Control buttons when running */}
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant={hasUpdate ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-7 text-xs gap-1 flex-1',
                hasUpdate &&
                  'bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground'
              )}
              onClick={handleRestart}
              disabled={isActioning}
              title={
                hasUpdate
                  ? `Restart to update: v${updateCheck?.currentVersion} -> v${updateCheck?.latestVersion}`
                  : 'Restart CLIProxy service'
              }
            >
              {isActioning ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : hasUpdate ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <RotateCw className="w-3 h-3" />
              )}
              {hasUpdate ? 'Update' : 'Restart'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              onClick={() => stopProxy.mutate()}
              disabled={isActioning}
              title="Stop CLIProxy service"
            >
              {stopProxy.isPending ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Square className="w-3 h-3" />
              )}
              Stop
            </Button>
          </div>
        </>
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

      {/* Version sync indicator */}
      {updateCheck?.currentVersion && (
        <div className="mt-2 pt-2 border-t border-muted flex items-center justify-between text-[10px] text-muted-foreground/70">
          <span>v{updateCheck.currentVersion}</span>
          {updateCheck.checkedAt && (
            <span title={new Date(updateCheck.checkedAt).toLocaleString()}>
              Synced {formatTimeAgo(updateCheck.checkedAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
