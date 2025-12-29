/**
 * Profile Editor Hook
 * Query + mutation logic for profile settings
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Settings, SettingsResponse } from './types';

/** Required env vars for profiles to function */
const REQUIRED_ENV_KEYS = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'] as const;

/** Validate settings have required fields */
function validateSettings(settings: Settings | undefined): {
  valid: boolean;
  missing: string[];
} {
  const env = settings?.env || {};
  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key]?.trim());
  return { valid: missing.length === 0, missing };
}

interface UseProfileEditorOptions {
  profileName: string;
  localEdits: Record<string, string>;
  rawJsonEdits: string | null;
  rawJsonContent: string;
  onSuccess: () => void;
  onConflict: () => void;
}

export function useProfileEditor({
  profileName,
  localEdits,
  rawJsonEdits,
  rawJsonContent,
  onSuccess,
  onConflict,
}: UseProfileEditorOptions) {
  const queryClient = useQueryClient();

  // Fetch settings for selected profile
  const query = useQuery<SettingsResponse>({
    queryKey: ['settings', profileName],
    queryFn: async () => {
      const res = await fetch(`/api/settings/${profileName}/raw`);
      if (!res.ok) {
        throw new Error(`Failed to load settings: ${res.status}`);
      }
      return res.json();
    },
  });

  // Derive current settings by merging original data with local edits
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Intentional: merge raw JSON edits over query data
  const currentSettings = useMemo((): Settings | undefined => {
    if (rawJsonEdits !== null) {
      try {
        return JSON.parse(rawJsonEdits);
      } catch {
        // If invalid JSON, fall back
      }
    }

    if (!query.data?.settings) return undefined;
    return {
      ...query.data.settings,
      env: {
        ...query.data.settings.env,
        ...localEdits,
      },
    };
  }, [query.data?.settings, localEdits, rawJsonEdits]);

  // Check if raw JSON is valid
  const isRawJsonValid = useMemo(() => {
    try {
      JSON.parse(rawJsonContent);
      return true;
    } catch {
      return false;
    }
  }, [rawJsonContent]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (rawJsonEdits !== null) {
      return rawJsonEdits !== JSON.stringify(query.data?.settings, null, 2);
    }
    return Object.keys(localEdits).length > 0;
  }, [rawJsonEdits, localEdits, query.data?.settings]);

  // Validation state for missing required fields
  const validationResult = useMemo(() => validateSettings(currentSettings), [currentSettings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      let settingsToSave: Settings;

      try {
        settingsToSave = JSON.parse(rawJsonContent);
      } catch {
        settingsToSave = {
          ...query.data?.settings,
          env: {
            ...query.data?.settings?.env,
            ...localEdits,
          },
        };
      }

      // Validate required fields before saving
      const validation = validateSettings(settingsToSave);
      if (!validation.valid) {
        throw new Error(`MISSING_REQUIRED:${validation.missing.join(',')}`);
      }

      const res = await fetch(`/api/settings/${profileName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: settingsToSave,
          expectedMtime: query.data?.mtime,
        }),
      });

      if (res.status === 409) {
        throw new Error('CONFLICT');
      }

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', profileName] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      onSuccess();
      toast.success('Settings saved');
    },
    onError: (error: Error) => {
      if (error.message === 'CONFLICT') {
        onConflict();
      } else if (error.message.startsWith('MISSING_REQUIRED:')) {
        const missing = error.message.replace('MISSING_REQUIRED:', '').split(',');
        toast.error(`Missing required fields: ${missing.join(', ')}`, {
          description: 'Apply a preset or add these fields manually.',
          duration: 6000,
        });
      } else {
        toast.error(error.message);
      }
    },
  });

  return {
    query,
    currentSettings,
    isRawJsonValid,
    hasChanges,
    saveMutation,
    /** List of required env vars that are missing (empty if all present) */
    missingRequiredFields: validationResult.missing,
  };
}
