/**
 * Account Item Component
 * Displays a single OAuth account with actions and quota bar
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { User, Star, MoreHorizontal, Clock, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIVACY_BLUR_CLASS } from '@/contexts/privacy-context';
import { useAccountQuota } from '@/hooks/use-cliproxy-stats';
import type { AccountItemProps } from './types';

/**
 * Format reset time as relative time (e.g., "in 2 hours")
 */
function formatResetTime(resetTime: string | null): string | null {
  if (!resetTime) return null;
  try {
    const reset = new Date(resetTime);
    const now = new Date();
    const diff = reset.getTime() - now.getTime();
    if (diff <= 0) return 'soon';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  } catch {
    return null;
  }
}

/**
 * Get color class based on quota percentage
 */
function getQuotaColor(percentage: number): string {
  if (percentage <= 20) return 'bg-destructive';
  if (percentage <= 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function AccountItem({
  account,
  onSetDefault,
  onRemove,
  isRemoving,
  privacyMode,
  showQuota,
}: AccountItemProps) {
  // Fetch quota for 'agy' provider accounts
  const { data: quota, isLoading: quotaLoading } = useAccountQuota(
    account.provider,
    account.id,
    showQuota && account.provider === 'agy'
  );

  // Calculate average quota across all models
  const avgQuota =
    quota?.success && quota.models.length > 0
      ? Math.round(quota.models.reduce((sum, m) => sum + m.percentage, 0) / quota.models.length)
      : null;

  // Get earliest reset time
  const nextReset =
    quota?.success && quota.models.length > 0
      ? quota.models.reduce(
          (earliest, m) => {
            if (!m.resetTime) return earliest;
            if (!earliest) return m.resetTime;
            return new Date(m.resetTime) < new Date(earliest) ? m.resetTime : earliest;
          },
          null as string | null
        )
      : null;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-3 rounded-lg border transition-colors',
        account.isDefault ? 'border-primary/30 bg-primary/5' : 'border-border hover:bg-muted/30'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full',
              account.isDefault ? 'bg-primary/10' : 'bg-muted'
            )}
          >
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn('font-medium text-sm', privacyMode && PRIVACY_BLUR_CLASS)}>
                {account.email || account.id}
              </span>
              {account.isDefault && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  Default
                </Badge>
              )}
            </div>
            {account.lastUsedAt && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Clock className="w-3 h-3" />
                Last used: {new Date(account.lastUsedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!account.isDefault && (
              <DropdownMenuItem onClick={onSetDefault}>
                <Star className="w-4 h-4 mr-2" />
                Set as default
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onRemove}
              disabled={isRemoving}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isRemoving ? 'Removing...' : 'Remove account'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quota bar - only for 'agy' provider */}
      {showQuota && account.provider === 'agy' && (
        <div className="pl-11">
          {quotaLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Loading quota...</span>
            </div>
          ) : avgQuota !== null ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={avgQuota}
                      className="h-2 flex-1"
                      indicatorClassName={getQuotaColor(avgQuota)}
                    />
                    <span className="text-xs font-medium w-10 text-right">{avgQuota}%</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="text-xs space-y-1">
                    <p className="font-medium">Model Quotas:</p>
                    {quota?.models.map((m) => (
                      <div key={m.name} className="flex justify-between gap-4">
                        <span className="truncate">{m.displayName || m.name}</span>
                        <span className="font-mono">{m.percentage}%</span>
                      </div>
                    ))}
                    {nextReset && (
                      <p className="text-muted-foreground mt-1">
                        Resets {formatResetTime(nextReset)}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : quota?.error ? (
            <div className="text-xs text-muted-foreground">{quota.error}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
