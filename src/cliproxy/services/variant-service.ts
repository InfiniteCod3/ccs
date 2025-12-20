/**
 * CLIProxy Variant Service
 *
 * Handles CRUD operations for CLIProxy variant profiles.
 * Supports both unified config (config.yaml) and legacy JSON format.
 */

import * as path from 'path';
import { CLIProxyProfileName } from '../../auth/profile-detector';
import { CLIProxyProvider } from '../types';
import { isReservedName } from '../../config/reserved-names';
import { isUnifiedMode } from '../../config/unified-config-loader';
import {
  createSettingsFile,
  createSettingsFileUnified,
  deleteSettingsFile,
  getRelativeSettingsPath,
} from './variant-settings';
import {
  VariantConfig,
  variantExistsInConfig,
  listVariantsFromConfig,
  saveVariantUnified,
  saveVariantLegacy,
  removeVariantFromUnifiedConfig,
  removeVariantFromLegacyConfig,
} from './variant-config-adapter';

// Re-export VariantConfig from adapter
export type { VariantConfig } from './variant-config-adapter';

/** Result of variant operations */
export interface VariantOperationResult {
  success: boolean;
  error?: string;
  variant?: VariantConfig;
  settingsPath?: string;
}

/**
 * Validate CLIProxy profile name
 */
export function validateProfileName(name: string): string | null {
  if (!name) {
    return 'Profile name is required';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(name)) {
    return 'Name must start with letter, contain only letters, numbers, dot, dash, underscore';
  }
  if (name.length > 32) {
    return 'Name must be 32 characters or less';
  }
  if (isReservedName(name)) {
    return `'${name}' is a reserved name`;
  }
  return null;
}

/**
 * Check if CLIProxy variant profile exists
 */
export function variantExists(name: string): boolean {
  return variantExistsInConfig(name);
}

/**
 * List all CLIProxy variants
 */
export function listVariants(): Record<string, VariantConfig> {
  return listVariantsFromConfig();
}

/**
 * Create a new CLIProxy variant
 */
export function createVariant(
  name: string,
  provider: CLIProxyProfileName,
  model: string,
  account?: string
): VariantOperationResult {
  try {
    let settingsPath: string;

    if (isUnifiedMode()) {
      settingsPath = createSettingsFileUnified(name, provider, model);
      saveVariantUnified(
        name,
        provider as CLIProxyProvider,
        getRelativeSettingsPath(provider, name),
        account
      );
    } else {
      settingsPath = createSettingsFile(name, provider, model);
      saveVariantLegacy(name, provider, `~/.ccs/${path.basename(settingsPath)}`, account);
    }

    return {
      success: true,
      settingsPath,
      variant: { provider, model, account },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Remove a CLIProxy variant
 */
export function removeVariant(name: string): VariantOperationResult {
  try {
    let variant: VariantConfig | null;

    if (isUnifiedMode()) {
      const unifiedVariant = removeVariantFromUnifiedConfig(name);
      if (unifiedVariant?.settings) {
        deleteSettingsFile(unifiedVariant.settings);
      }
      variant = unifiedVariant;
    } else {
      variant = removeVariantFromLegacyConfig(name);
      if (variant?.settings) {
        deleteSettingsFile(variant.settings);
      }
    }

    if (!variant) {
      return { success: false, error: `Variant '${name}' not found` };
    }

    return { success: true, variant };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
