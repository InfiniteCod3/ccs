/**
 * Account Card Component for Flow Visualization
 */

import { cn } from '@/lib/utils';
import { PRIVACY_BLUR_CLASS } from '@/contexts/privacy-context';
import { GripVertical } from 'lucide-react';

import type { AccountData, DragOffset } from './types';
import { cleanEmail } from './utils';
import { AccountCardStats } from './account-card-stats';

type Zone = 'left' | 'right' | 'top' | 'bottom';

interface AccountCardProps {
  account: AccountData;
  zone: Zone;
  originalIndex: number;
  isHovered: boolean;
  isDragging: boolean;
  offset: DragOffset;
  showDetails: boolean;
  privacyMode: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
}

const BORDER_SIDE_MAP: Record<Zone, string> = {
  left: 'border-l-2',
  right: 'border-r-2',
  top: 'border-t-2',
  bottom: 'border-b-2',
};

const CONNECTOR_POSITION_MAP: Record<Zone, string> = {
  left: 'top-1/2 -right-1.5 -translate-y-1/2',
  right: 'top-1/2 -left-1.5 -translate-y-1/2',
  top: 'left-1/2 -bottom-1.5 -translate-x-1/2',
  bottom: 'left-1/2 -top-1.5 -translate-x-1/2',
};

function getBorderColorStyle(zone: Zone, color: string): React.CSSProperties {
  switch (zone) {
    case 'left':
      return { borderLeftColor: color };
    case 'right':
      return { borderRightColor: color };
    case 'top':
      return { borderTopColor: color };
    case 'bottom':
      return { borderBottomColor: color };
  }
}

export function AccountCard({
  account,
  zone,
  originalIndex,
  isHovered,
  isDragging,
  offset,
  showDetails,
  privacyMode,
  onMouseEnter,
  onMouseLeave,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: AccountCardProps) {
  const borderSide = BORDER_SIDE_MAP[zone];
  const borderColor = getBorderColorStyle(zone, account.color);
  const connectorPosition = CONNECTOR_POSITION_MAP[zone];

  return (
    <div
      data-account-index={originalIndex}
      data-zone={zone}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn(
        'group/card relative rounded-lg p-3 w-44 cursor-grab transition-shadow duration-200',
        'bg-muted/30 dark:bg-zinc-900/60 backdrop-blur-sm',
        'border border-border/50 dark:border-white/[0.08]',
        borderSide,
        'select-none touch-none',
        isHovered && 'bg-muted/50 dark:bg-zinc-800/60',
        isDragging && 'cursor-grabbing shadow-xl scale-105 z-50'
      )}
      style={{
        ...borderColor,
        transform: `translate(${offset.x}px, ${offset.y}px)${isDragging ? ' scale(1.05)' : ''}`,
      }}
    >
      <GripVertical className="absolute top-2 right-2 w-4 h-4 text-muted-foreground/40" />
      <div className="flex justify-between items-start mb-1 mr-4">
        <span
          className={cn(
            'text-xs font-semibold text-foreground tracking-tight truncate max-w-[100px]',
            privacyMode && PRIVACY_BLUR_CLASS
          )}
        >
          {cleanEmail(account.email)}
        </span>
      </div>
      <AccountCardStats
        success={account.successCount}
        failure={account.failureCount}
        showDetails={showDetails}
      />
      <div
        className={cn(
          'absolute w-3 h-3 rounded-full transform z-20 transition-colors border',
          'bg-muted dark:bg-zinc-800 border-border dark:border-zinc-600',
          connectorPosition,
          isHovered && 'bg-foreground dark:bg-white border-transparent'
        )}
      />
    </div>
  );
}
