/**
 * Router Profile Editor - Edit profile details with tier configurations
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, TestTube2, Loader2 } from 'lucide-react';
import { RouterTierConfig } from './router-tier-config';
import { useRouterProviders } from '@/hooks/use-router-providers';
import { useUpdateRouterProfile, useTestRouterProfile } from '@/hooks/use-router-profiles';
import type { RouterProfile, TierConfig } from '@/lib/router-types';

interface RouterProfileEditorProps {
  profile: RouterProfile;
  onHasChanges?: (hasChanges: boolean) => void;
}

export function RouterProfileEditor({ profile, onHasChanges }: RouterProfileEditorProps) {
  const [description, setDescription] = useState(profile.description ?? '');
  const [tiers, setTiers] = useState(profile.tiers);

  const { data: providersData } = useRouterProviders();
  const updateMutation = useUpdateRouterProfile();
  const testMutation = useTestRouterProfile();

  const providers = providersData?.providers ?? [];

  // Track changes
  const hasChanges =
    description !== (profile.description ?? '') ||
    JSON.stringify(tiers) !== JSON.stringify(profile.tiers);

  useEffect(() => {
    onHasChanges?.(hasChanges);
  }, [hasChanges, onHasChanges]);

  const handleTierChange = useCallback((tier: 'opus' | 'sonnet' | 'haiku', config: TierConfig) => {
    setTiers((prev) => ({ ...prev, [tier]: config }));
  }, []);

  const handleSave = () => {
    updateMutation.mutate({
      name: profile.name,
      data: { description: description || undefined, tiers },
    });
  };

  const handleTest = () => {
    testMutation.mutate(profile.name);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg">{profile.name}</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testMutation.isPending}
          >
            {testMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <TestTube2 className="w-4 h-4 mr-1" />
            )}
            Test
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Save
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </div>

        <div className="space-y-4">
          <Label>Tier Configuration</Label>
          {(['opus', 'sonnet', 'haiku'] as const).map((tier) => (
            <RouterTierConfig
              key={tier}
              tier={tier}
              config={tiers[tier]}
              providers={providers}
              onChange={(config) => handleTierChange(tier, config)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
