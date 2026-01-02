/**
 * Router Profile Card - Display profile summary in list
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Layers } from 'lucide-react';
import type { RouterProfileSummary } from '@/lib/router-types';

interface RouterProfileCardProps {
  profile: RouterProfileSummary;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function RouterProfileCard({
  profile,
  isActive,
  onClick,
  onDelete,
}: RouterProfileCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-muted/50 group ${
        isActive ? 'border-primary bg-muted/30' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{profile.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {profile.tiers.map((tier) => (
              <Badge key={tier} variant="outline" className="text-xs">
                {tier}
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
        {profile.description && (
          <p className="mt-1 text-sm text-muted-foreground truncate">{profile.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
