/**
 * Error Logs Monitor Component
 *
 * Displays CLIProxyAPI error logs with expandable details.
 * Designed to complement the AuthMonitor on the Home page.
 */

import { useState } from 'react';
import { useCliproxyErrorLogs, useCliproxyErrorLogContent } from '@/hooks/use-cliproxy-stats';
import { useCliproxyStatus } from '@/hooks/use-cliproxy-stats';
import { cn, STATUS_COLORS } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileWarning,
  Clock,
  FileText,
  XCircle,
} from 'lucide-react';

/** Format file size in human-readable format */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format timestamp to relative time */
function formatRelativeTime(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000 - unixSeconds);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Parse error log filename to extract endpoint and timestamp */
function parseErrorLogName(name: string): { endpoint: string; timestamp: string } {
  // Format: error-v1-chat-completions-2025-01-15T10-30-00.log
  const match = name.match(/^error-(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.log$/);
  if (match) {
    const endpoint = match[1].replace(/-/g, '/');
    const timestamp = match[2].replace(/T/, ' ').replace(/-/g, ':');
    return { endpoint: `/${endpoint}`, timestamp };
  }
  return { endpoint: name, timestamp: '' };
}

/** Error log content viewer with syntax highlighting */
function ErrorLogContent({ name }: { name: string }) {
  const { data: content, isLoading, error } = useCliproxyErrorLogContent(name);

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="p-4 text-xs text-muted-foreground">Failed to load error log content</div>
    );
  }

  return (
    <ScrollArea className="h-[200px] rounded-md">
      <pre className="p-4 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
        {content}
      </pre>
    </ScrollArea>
  );
}

export function ErrorLogsMonitor() {
  const { data: status } = useCliproxyStatus();
  const { data: logs, isLoading, error } = useCliproxyErrorLogs(status?.running);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Don't show if proxy not running or loading
  if (!status?.running) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border overflow-hidden font-mono text-[13px] bg-card/50 dark:bg-zinc-900/60 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Don't show if no errors (good state)
  if (!logs || logs.length === 0) {
    return null;
  }

  const errorCount = logs.length;

  return (
    <div className="rounded-xl border border-border overflow-hidden font-mono text-[13px] text-foreground bg-card/50 dark:bg-zinc-900/60 backdrop-blur-sm">
      {/* Header with warning styling */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-gradient-to-r from-amber-500/10 via-transparent to-transparent dark:from-amber-500/15">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-5 h-5">
            <AlertTriangle className="w-4 h-4" style={{ color: STATUS_COLORS.degraded }} />
          </div>
          <span className="text-xs font-semibold tracking-tight text-foreground">Error Logs</span>
          <span className="text-[10px] text-muted-foreground">
            {errorCount} failed request{errorCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <FileWarning className="w-3 h-3" />
          <span>CLIProxy Diagnostics</span>
        </div>
      </div>

      {/* Error logs list */}
      <ScrollArea className="max-h-[300px]">
        <div className="divide-y divide-border">
          {logs.slice(0, 10).map((log) => {
            const isExpanded = expandedLog === log.name;
            const { endpoint, timestamp } = parseErrorLogName(log.name);

            return (
              <div key={log.name} className="bg-background/50">
                <button
                  onClick={() => setExpandedLog(isExpanded ? null : log.name)}
                  className={cn(
                    'w-full px-4 py-3 flex items-center gap-3 text-left transition-colors',
                    'hover:bg-muted/30',
                    isExpanded && 'bg-muted/20'
                  )}
                >
                  {/* Expand icon */}
                  <div className="shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Error indicator */}
                  <XCircle className="w-4 h-4 shrink-0" style={{ color: STATUS_COLORS.failed }} />

                  {/* Endpoint */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" title={endpoint}>
                      {endpoint}
                    </div>
                    {timestamp && (
                      <div className="text-[10px] text-muted-foreground">{timestamp}</div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 shrink-0 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>{formatSize(log.size)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatRelativeTime(log.modified)}</span>
                    </div>
                  </div>
                </button>

                {/* Expandable content */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/10">
                    <ErrorLogContent name={log.name} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Show more indicator */}
        {logs.length > 10 && (
          <div className="px-4 py-2 text-center text-[10px] text-muted-foreground border-t border-border">
            Showing 10 of {logs.length} error logs
          </div>
        )}
      </ScrollArea>

      {/* Footer hint */}
      {error && (
        <div className="px-4 py-2 border-t border-border text-[10px] text-destructive">
          {error.message}
        </div>
      )}
    </div>
  );
}
