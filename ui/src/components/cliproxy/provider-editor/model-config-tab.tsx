/**
 * Model Config Tab
 * Contains model config section and accounts section
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ModelConfigSection } from './model-config-section';
import { AccountsSection } from './accounts-section';
import type { ProviderCatalog } from '../provider-model-selector';
import type { OAuthAccount } from '@/lib/api-client';

interface ModelConfigTabProps {
  catalog?: ProviderCatalog;
  savedPresets: Array<{
    name: string;
    default: string;
    opus: string;
    sonnet: string;
    haiku: string;
  }>;
  currentModel?: string;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
  providerModels: Array<{ id: string; owned_by: string }>;
  onApplyPreset: (updates: Record<string, string>) => void;
  onUpdateEnvValue: (key: string, value: string) => void;
  onOpenCustomPreset: () => void;
  onDeletePreset: (name: string) => void;
  isDeletePending?: boolean;
  accounts: OAuthAccount[];
  onAddAccount: () => void;
  onSetDefault: (accountId: string) => void;
  onRemoveAccount: (accountId: string) => void;
  isRemovingAccount?: boolean;
  privacyMode?: boolean;
}

export function ModelConfigTab({
  catalog,
  savedPresets,
  currentModel,
  opusModel,
  sonnetModel,
  haikuModel,
  providerModels,
  onApplyPreset,
  onUpdateEnvValue,
  onOpenCustomPreset,
  onDeletePreset,
  isDeletePending,
  accounts,
  onAddAccount,
  onSetDefault,
  onRemoveAccount,
  isRemovingAccount,
  privacyMode,
}: ModelConfigTabProps) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        <ModelConfigSection
          catalog={catalog}
          savedPresets={savedPresets}
          currentModel={currentModel}
          opusModel={opusModel}
          sonnetModel={sonnetModel}
          haikuModel={haikuModel}
          providerModels={providerModels}
          onApplyPreset={onApplyPreset}
          onUpdateEnvValue={onUpdateEnvValue}
          onOpenCustomPreset={onOpenCustomPreset}
          onDeletePreset={onDeletePreset}
          isDeletePending={isDeletePending}
        />
        <Separator />
        <AccountsSection
          accounts={accounts}
          onAddAccount={onAddAccount}
          onSetDefault={onSetDefault}
          onRemoveAccount={onRemoveAccount}
          isRemovingAccount={isRemovingAccount}
          privacyMode={privacyMode}
        />
      </div>
    </ScrollArea>
  );
}
