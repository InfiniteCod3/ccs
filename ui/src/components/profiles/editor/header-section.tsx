/**
 * Profile Editor Header Section
 * Top header with profile name, badge, last modified, and action buttons
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Trash2, RefreshCw } from 'lucide-react';

interface HeaderSectionProps {
  profileName: string;
  data: { path?: string; mtime: number } | undefined;
  isLoading: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  isRawJsonValid: boolean;
  onRefresh: () => void;
  onDelete?: () => void;
  onSave: () => void;
}

export function HeaderSection({
  profileName,
  data,
  isLoading,
  isSaving,
  hasChanges,
  isRawJsonValid,
  onRefresh,
  onDelete,
  onSave,
}: HeaderSectionProps) {
  return (
    <div className="px-6 py-4 border-b bg-background flex items-center justify-between shrink-0">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{profileName}</h2>
          {data?.path && (
            <Badge variant="outline" className="text-xs">
              {data.path.replace(/^.*\//, '')}
            </Badge>
          )}
        </div>
        {data && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Last modified: {new Date(data.mtime).toLocaleString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        )}
        <Button size="sm" onClick={onSave} disabled={isSaving || !hasChanges || !isRawJsonValid}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-1" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
