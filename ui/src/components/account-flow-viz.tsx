/**
 * Account Flow Visualization
 * Custom SVG bezier curve visualization showing request flow from accounts to providers
 * Inspired by modern dark theme design with glass panels and glow effects
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ProviderIcon } from '@/components/provider-icon';
import { PROVIDER_COLORS } from '@/lib/provider-config';
import { STATUS_COLORS } from '@/lib/utils';
import { ChevronRight, X, CheckCircle2, XCircle, Clock, Activity } from 'lucide-react';

interface AccountData {
  id: string;
  email: string;
  provider: string;
  successCount: number;
  failureCount: number;
  lastUsedAt?: string;
  color: string;
}

interface ProviderData {
  provider: string;
  displayName: string;
  totalRequests: number;
  accounts: AccountData[];
}

interface AccountFlowVizProps {
  providerData: ProviderData;
  onBack?: () => void;
}

interface ConnectionEvent {
  id: string;
  timestamp: Date;
  accountEmail: string;
  status: 'success' | 'failed' | 'pending';
  latencyMs?: number;
}

/** Generate connection events from real account data */
function generateConnectionEvents(accounts: AccountData[]): ConnectionEvent[] {
  const events: ConnectionEvent[] = [];

  accounts.forEach((account) => {
    // Only show events for accounts that have actual request data
    const hasActivity = account.successCount > 0 || account.failureCount > 0;
    if (!hasActivity) return;

    // Create a single consolidated event per account showing its current status
    const lastUsed = account.lastUsedAt ? new Date(account.lastUsedAt) : new Date();
    const hasFailures = account.failureCount > 0;

    events.push({
      id: `${account.id}-status`,
      timestamp: lastUsed,
      accountEmail: account.email,
      status: hasFailures && account.failureCount > account.successCount ? 'failed' : 'success',
    });
  });

  // Sort by timestamp descending (most recent first)
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/** Format timestamp for timeline display */
function formatTimelineTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

/** Connection Timeline Component - right sidebar panel */
function ConnectionTimeline({ events }: { events: ConnectionEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="h-full flex items-center justify-center rounded-xl bg-muted/20 dark:bg-zinc-900/40 border border-border/30 dark:border-white/[0.05]">
        <div className="text-xs text-muted-foreground font-mono">No recent connections</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-2">
        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          Connection Timeline
        </span>
      </div>

      {/* Timeline container */}
      <div
        className={cn(
          'flex-1 rounded-xl p-4 overflow-y-auto',
          'bg-muted/20 dark:bg-zinc-900/40 backdrop-blur-sm',
          'border border-border/30 dark:border-white/[0.05]'
        )}
      >
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/50 dark:bg-white/[0.08]" />

          {/* Events */}
          <div className="space-y-3">
            {events.slice(0, 8).map((event) => {
              const statusColor =
                event.status === 'success'
                  ? STATUS_COLORS.success
                  : event.status === 'failed'
                    ? STATUS_COLORS.failed
                    : STATUS_COLORS.degraded;

              return (
                <div key={event.id} className="relative flex items-start gap-3 pl-1">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'relative z-10 w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5',
                      'ring-2 ring-background dark:ring-zinc-950'
                    )}
                    style={{ backgroundColor: statusColor }}
                  />

                  {/* Event content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-foreground truncate">
                        {cleanEmail(event.accountEmail)}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">
                        {formatTimelineTime(event.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[9px] font-medium uppercase"
                        style={{ color: statusColor }}
                      >
                        {event.status}
                      </span>
                      {event.latencyMs && (
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {event.latencyMs}ms
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show more indicator */}
          {events.length > 8 && (
            <div className="mt-3 pt-2 border-t border-border/30 dark:border-white/[0.05]">
              <span className="text-[9px] text-muted-foreground font-mono">
                +{events.length - 8} more events
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Strip common email domains for cleaner display */
function cleanEmail(email: string): string {
  return email.replace(/@(gmail|yahoo|hotmail|outlook|icloud)\.com$/i, '');
}

function getTimeAgo(dateStr?: string): string {
  if (!dateStr) return 'never';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'unknown';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'just now';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function AccountFlowViz({ providerData, onBack }: AccountFlowVizProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredAccount, setHoveredAccount] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountData | null>(null);
  const [paths, setPaths] = useState<string[]>([]);

  const { accounts } = providerData;
  const maxRequests = Math.max(...accounts.map((a) => a.successCount + a.failureCount), 1);
  const totalRequests = accounts.reduce((acc, a) => acc + a.successCount + a.failureCount, 0);

  // Generate connection events for timeline
  const connectionEvents = useMemo(() => generateConnectionEvents(accounts), [accounts]);

  // Calculate SVG paths for bezier curves
  const calculatePaths = useCallback(() => {
    if (!containerRef.current || !svgRef.current) return;

    const container = containerRef.current;
    const svg = svgRef.current;
    const svgRect = svg.getBoundingClientRect();

    const destEl = container.querySelector('[data-provider-node]');
    if (!destEl) return;
    const destRect = destEl.getBoundingClientRect();

    // Destination point (left center of provider card)
    const destX = destRect.left - svgRect.left;
    const destY = destRect.top + destRect.height / 2 - svgRect.top;

    const newPaths: string[] = [];

    accounts.forEach((_, i) => {
      const sourceEl = container.querySelector(`[data-account-index="${i}"]`);
      if (!sourceEl) return;
      const sourceRect = sourceEl.getBoundingClientRect();

      // Source point (right center of account card)
      const startX = sourceRect.right - svgRect.left;
      const startY = sourceRect.top + sourceRect.height / 2 - svgRect.top;

      // Bezier control points
      const cp1X = startX + (destX - startX) * 0.5;
      const cp1Y = startY;
      const cp2X = destX - (destX - startX) * 0.5;
      const cp2Y = destY;

      newPaths.push(`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${destX} ${destY}`);
    });

    setPaths(newPaths);
  }, [accounts]);

  useEffect(() => {
    // Initial calculation after render
    const timer = setTimeout(calculatePaths, 50);
    window.addEventListener('resize', calculatePaths);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePaths);
    };
  }, [calculatePaths]);

  const providerColor = PROVIDER_COLORS[providerData.provider.toLowerCase()] || '#6b7280';

  return (
    <div className="flex flex-col" ref={containerRef}>
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-3 h-3 rotate-180" />
          <span>Back to providers</span>
        </button>
      )}

      {/* Main visualization area - 2 column layout: Flow viz (left) | Timeline (right) */}
      <div className="min-h-[320px] flex gap-4 px-4 py-6">
        {/* Left Section: Account → Provider Flow - expands to fill available space */}
        <div className="relative flex-1 flex items-center justify-between px-8">
          {/* SVG Canvas (Background) */}
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
          >
            <defs>
              <filter id="flow-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            {paths.map((d, i) => {
              const account = accounts[i];
              const total = account.successCount + account.failureCount;
              const strokeWidth = Math.max(2, (total / maxRequests) * 10);
              const isHovered = hoveredAccount === i;
              const isDimmed = hoveredAccount !== null && hoveredAccount !== i;

              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={account.color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={isHovered ? 0.9 : isDimmed ? 0.05 : 0.2}
                  strokeLinecap="round"
                  filter={isHovered ? 'url(#flow-glow)' : undefined}
                  className="transition-all duration-300"
                />
              );
            })}
          </svg>

          {/* Source Accounts */}
          <div className="flex flex-col gap-3 z-10 w-48 justify-center">
            {accounts.map((account, i) => {
              const total = account.successCount + account.failureCount;
              const isHovered = hoveredAccount === i;

              return (
                <div
                  key={account.id}
                  data-account-index={i}
                  onClick={() => setSelectedAccount(account)}
                  onMouseEnter={() => setHoveredAccount(i)}
                  onMouseLeave={() => setHoveredAccount(null)}
                  className={cn(
                    'group/card relative rounded-lg p-3 pr-6 cursor-pointer transition-all duration-300',
                    'bg-muted/30 dark:bg-zinc-900/60 backdrop-blur-sm',
                    'border border-border/50 dark:border-white/[0.08]',
                    'border-l-2 hover:translate-x-1',
                    isHovered && 'bg-muted/50 dark:bg-zinc-800/60'
                  )}
                  style={{ borderLeftColor: account.color }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-foreground tracking-tight truncate max-w-[120px]">
                      {cleanEmail(account.email)}
                    </span>
                    <ChevronRight
                      className={cn(
                        'w-3.5 h-3.5 text-muted-foreground transition-opacity',
                        isHovered ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {total.toLocaleString()} reqs
                    </span>
                    <div className="flex gap-1">
                      {account.failureCount > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                      )}
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                    </div>
                  </div>
                  {/* Connector Dot */}
                  <div
                    className={cn(
                      'absolute top-1/2 -right-1.5 w-3 h-3 rounded-full transform -translate-y-1/2 z-20 transition-colors border',
                      'bg-muted dark:bg-zinc-800 border-border dark:border-zinc-600',
                      isHovered && 'bg-foreground dark:bg-white border-transparent'
                    )}
                  />
                </div>
              );
            })}
          </div>

          {/* Destination Provider */}
          <div className="z-10 w-48 flex items-center">
            <div
              data-provider-node
              className={cn(
                'group relative w-full rounded-xl p-4 cursor-pointer transition-all duration-300',
                'bg-muted/30 dark:bg-zinc-900/60 backdrop-blur-sm',
                'border border-border/50 dark:border-white/[0.08]',
                hoveredAccount !== null && 'scale-[1.02]'
              )}
              style={{
                borderColor: hoveredAccount !== null ? `${providerColor}50` : undefined,
              }}
            >
              {/* Connector Point */}
              <div
                className="absolute top-1/2 -left-1.5 w-3 h-3 rounded-full transform -translate-y-1/2"
                style={{
                  backgroundColor: providerColor,
                  boxShadow: `0 0 0 4px var(--background)`,
                }}
              />

              <div className="flex items-center gap-3 mb-4">
                <ProviderIcon provider={providerData.provider} size={36} withBackground />
                <div>
                  <h3 className="text-sm font-semibold text-foreground tracking-tight">
                    {providerData.displayName}
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">
                    Provider
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Total Requests</span>
                  <span className="text-foreground font-mono">
                    {totalRequests.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Accounts</span>
                  <span className="text-foreground font-mono">{accounts.length}</span>
                </div>
                <div className="w-full bg-muted dark:bg-zinc-800/50 h-1 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (totalRequests / (maxRequests * accounts.length)) * 100)}%`,
                      backgroundColor: providerColor,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Connection Timeline - Fixed compact width */}
        <div className="w-56 flex-shrink-0">
          <ConnectionTimeline events={connectionEvents} />
        </div>
      </div>

      {/* Detail Panel - slides in from bottom, pushes content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-out',
          selectedAccount ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className={cn('bg-card dark:bg-zinc-950 border-t border-border', 'p-4')}>
          <div className="relative">
            <button
              onClick={() => setSelectedAccount(null)}
              className="absolute top-0 right-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {selectedAccount && (
              <div className="grid grid-cols-4 gap-4">
                {/* Account Info */}
                <div className="border-r border-border pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: selectedAccount.color }}
                    />
                    <span className="text-sm font-semibold text-foreground tracking-tight truncate">
                      {cleanEmail(selectedAccount.email)}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Source Account
                  </div>
                </div>

                {/* Stats */}
                <div className="bg-muted/30 dark:bg-zinc-900/50 rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>SUCCESSFUL</span>
                  </div>
                  <div className="text-xl font-mono text-emerald-500 tracking-tighter">
                    {selectedAccount.successCount.toLocaleString()}
                  </div>
                </div>

                <div className="bg-muted/30 dark:bg-zinc-900/50 rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                    <XCircle className="w-3 h-3 text-red-500" />
                    <span>FAILED</span>
                  </div>
                  <div className="text-xl font-mono text-red-500 tracking-tighter">
                    {selectedAccount.failureCount.toLocaleString()}
                  </div>
                </div>

                <div className="bg-muted/30 dark:bg-zinc-900/50 rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                    <Clock className="w-3 h-3" />
                    <span>LAST SYNC</span>
                  </div>
                  <div className="text-sm font-mono text-foreground mt-1">
                    {getTimeAgo(selectedAccount.lastUsedAt)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
