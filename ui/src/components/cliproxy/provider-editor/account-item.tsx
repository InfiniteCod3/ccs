/**
 * Account Item Component
 * Displays a single OAuth account with actions
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Star, MoreHorizontal, Clock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIVACY_BLUR_CLASS } from '@/contexts/privacy-context';
import type { AccountItemProps } from './types';

export function AccountItem({
  account,
  onSetDefault,
  onRemove,
  isRemoving,
  privacyMode,
}: AccountItemProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border transition-colors',
        account.isDefault ? 'border-primary/30 bg-primary/5' : 'border-border hover:bg-muted/30'
      )}
    >
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
  );
}
