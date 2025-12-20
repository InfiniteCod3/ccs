/**
 * Friendly UI Section
 * Left column with environment variables and info tabs
 * Enhanced with OpenRouter model picker when applicable
 */

import { useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnvEditorSection } from './env-editor-section';
import { InfoSection } from './info-section';
import { OpenRouterModelPicker } from '@/components/profiles/openrouter-model-picker';
import { ModelTierMapping, type TierMapping } from '@/components/profiles/model-tier-mapping';
import { isOpenRouterProfile, extractTierMapping, applyTierMapping } from './utils';
import type { Settings, SettingsResponse } from './types';

interface FriendlyUISectionProps {
  profileName: string;
  data: SettingsResponse | undefined;
  currentSettings: Settings | undefined;
  newEnvKey: string;
  onNewEnvKeyChange: (key: string) => void;
  onEnvValueChange: (key: string, value: string) => void;
  onAddEnvVar: () => void;
  onEnvBulkChange?: (env: Record<string, string>) => void;
}

export function FriendlyUISection({
  profileName,
  data,
  currentSettings,
  newEnvKey,
  onNewEnvKeyChange,
  onEnvValueChange,
  onAddEnvVar,
  onEnvBulkChange,
}: FriendlyUISectionProps) {
  const isOpenRouter = isOpenRouterProfile(currentSettings);
  const settingsEnv = currentSettings?.env;

  // Derive tier mapping from env vars (no local state to sync)
  const tierMapping = useMemo<TierMapping>(
    () => extractTierMapping(settingsEnv ?? {}),
    [settingsEnv]
  );

  // Memoize currentEnv for consistent reference
  const currentEnv = settingsEnv ?? {};

  // Handle model selection from OpenRouter picker
  const handleModelChange = (modelId: string) => {
    onEnvValueChange('ANTHROPIC_MODEL', modelId);
  };

  // Handle tier mapping change
  const handleTierMappingChange = (mapping: TierMapping) => {
    // Apply tier mapping to env vars
    if (onEnvBulkChange) {
      const newEnv = applyTierMapping(currentEnv, mapping);
      onEnvBulkChange(newEnv);
    } else {
      // Fallback: update one by one
      if (mapping.opus !== undefined) {
        onEnvValueChange('ANTHROPIC_DEFAULT_OPUS_MODEL', mapping.opus || '');
      }
      if (mapping.sonnet !== undefined) {
        onEnvValueChange('ANTHROPIC_DEFAULT_SONNET_MODEL', mapping.sonnet || '');
      }
      if (mapping.haiku !== undefined) {
        onEnvValueChange('ANTHROPIC_DEFAULT_HAIKU_MODEL', mapping.haiku || '');
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="env" className="h-full flex flex-col">
        <div className="px-4 pt-4 shrink-0">
          <TabsList className="w-full">
            <TabsTrigger value="env" className="flex-1">
              Environment Variables
            </TabsTrigger>
            <TabsTrigger value="info" className="flex-1">
              Info & Usage
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <TabsContent
            value="env"
            className="flex-1 mt-0 border-0 p-0 data-[state=inactive]:hidden flex flex-col overflow-hidden"
          >
            {/* OpenRouter Model Picker Section */}
            {isOpenRouter && (
              <div className="px-4 pt-4 pb-2 border-b space-y-3 shrink-0">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Model (OpenRouter)
                  </label>
                  <OpenRouterModelPicker
                    value={currentEnv.ANTHROPIC_MODEL}
                    onChange={handleModelChange}
                    placeholder="Search OpenRouter models..."
                  />
                </div>
                <ModelTierMapping
                  selectedModel={currentEnv.ANTHROPIC_MODEL}
                  value={tierMapping}
                  onChange={handleTierMappingChange}
                />
              </div>
            )}

            <EnvEditorSection
              currentSettings={currentSettings}
              newEnvKey={newEnvKey}
              onNewEnvKeyChange={onNewEnvKeyChange}
              onEnvValueChange={onEnvValueChange}
              onAddEnvVar={onAddEnvVar}
            />
          </TabsContent>

          <TabsContent
            value="info"
            className="h-full mt-0 border-0 p-0 data-[state=inactive]:hidden"
          >
            <InfoSection profileName={profileName} data={data} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
