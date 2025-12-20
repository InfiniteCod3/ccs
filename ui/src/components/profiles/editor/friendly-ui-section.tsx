/**
 * Friendly UI Section
 * Left column with environment variables and info tabs
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnvEditorSection } from './env-editor-section';
import { InfoSection } from './info-section';
import type { Settings, SettingsResponse } from './types';

interface FriendlyUISectionProps {
  profileName: string;
  data: SettingsResponse | undefined;
  currentSettings: Settings | undefined;
  newEnvKey: string;
  onNewEnvKeyChange: (key: string) => void;
  onEnvValueChange: (key: string, value: string) => void;
  onAddEnvVar: () => void;
}

export function FriendlyUISection({
  profileName,
  data,
  currentSettings,
  newEnvKey,
  onNewEnvKeyChange,
  onEnvValueChange,
  onAddEnvVar,
}: FriendlyUISectionProps) {
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
