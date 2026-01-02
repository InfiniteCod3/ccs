/**
 * Router Profile Editor - Edit profile details with tier configurations
 * 2-column layout with tier config on left and YAML preview on right
 */

import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, TestTube2, Loader2, Code2, Terminal } from 'lucide-react';
import { RouterTierConfig } from './router-tier-config';
import { useRouterProviders } from '@/hooks/use-router-providers';
import { useUpdateRouterProfile, useTestRouterProfile } from '@/hooks/use-router-profiles';
import { CopyButton } from '@/components/ui/copy-button';
import type { RouterProfile, TierConfig } from '@/lib/router-types';

// Lazy load CodeEditor
const CodeEditor = lazy(() =>
  import('@/components/shared/code-editor').then((m) => ({ default: m.CodeEditor }))
);

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

  // Generate YAML preview for the config panel
  const yamlPreview = useMemo(() => {
    const tierToYaml = (tier: TierConfig) => {
      const lines = [
        `      provider: ${tier.provider || '""'}`,
        `      model: ${tier.model || '""'}`,
      ];
      if (tier.fallback && tier.fallback.length > 0) {
        lines.push('      fallback:');
        tier.fallback.forEach((fb) => {
          lines.push(`        - provider: ${fb.provider}`);
          lines.push(`          model: ${fb.model}`);
        });
      }
      return lines.join('\n');
    };

    return `# Router Profile: ${profile.name}
${description ? `# ${description}\n` : ''}
router:
  profiles:
    ${profile.name}:
      description: ${description ? `"${description}"` : '""'}
      tiers:
        opus:
${tierToYaml(tiers.opus)
  .split('\n')
  .map((l) => '  ' + l)
  .join('\n')}
        sonnet:
${tierToYaml(tiers.sonnet)
  .split('\n')
  .map((l) => '  ' + l)
  .join('\n')}
        haiku:
${tierToYaml(tiers.haiku)
  .split('\n')
  .map((l) => '  ' + l)
  .join('\n')}`;
  }, [profile.name, description, tiers]);

  // CLI command to use this profile
  const cliCommand = `ccs ${profile.name} "Your prompt here"`;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-background flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{profile.name}</h2>
          <p className="text-sm text-muted-foreground">Configure tier routing for this profile</p>
        </div>
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
      </div>

      {/* 2-column layout */}
      <div className="flex-1 grid grid-cols-[55%_45%] divide-x overflow-hidden">
        {/* Left: Tier Configuration */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Route opus to Gemini, sonnet to AGY, haiku to GLM"
              />
            </div>

            {/* Tier Configurations */}
            <div className="space-y-4">
              <Label>Tier Configuration</Label>
              <p className="text-xs text-muted-foreground -mt-2">
                Map each Claude tier to a provider. Requests will be routed based on the requested
                tier.
              </p>
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

            {/* CLI Usage */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                CLI Usage
              </Label>
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-3">
                <code className="flex-1 text-sm font-mono">{cliCommand}</code>
                <CopyButton value={cliCommand} />
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Right: YAML Preview */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2 shrink-0 h-[45px]">
            <Code2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Configuration (YAML)</span>
            <span className="text-xs text-muted-foreground ml-auto">Read-only</span>
          </div>
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <div className="flex-1 overflow-hidden p-4">
              <div className="h-full border rounded-md overflow-hidden bg-background">
                <CodeEditor
                  value={yamlPreview}
                  onChange={() => {}}
                  language="yaml"
                  minHeight="100%"
                  readonly
                />
              </div>
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
