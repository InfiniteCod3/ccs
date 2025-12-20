/**
 * API Profile Reader Service
 *
 * Read operations for API profiles.
 * Supports both unified YAML config and legacy JSON config.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir, loadConfig } from '../../utils/config-manager';
import { loadOrCreateUnifiedConfig, isUnifiedMode } from '../../config/unified-config-loader';
import { getProfileSecrets } from '../../config/secrets-manager';
import type { ApiProfileInfo, CliproxyVariantInfo, ApiListResult } from './profile-types';

/**
 * Check if API profile exists in config
 */
export function apiProfileExists(name: string): boolean {
  try {
    if (isUnifiedMode()) {
      const config = loadOrCreateUnifiedConfig();
      return name in config.profiles;
    }
    const config = loadConfig();
    return name in config.profiles;
  } catch {
    return false;
  }
}

/**
 * Check if API profile has real API key (not placeholder)
 */
export function isApiProfileConfigured(apiName: string): boolean {
  try {
    if (isUnifiedMode()) {
      const secrets = getProfileSecrets(apiName);
      const token = secrets?.ANTHROPIC_AUTH_TOKEN || '';
      return token.length > 0 && !token.includes('YOUR_') && !token.includes('your-');
    }
    // Legacy: check settings.json file
    const ccsDir = getCcsDir();
    const settingsPath = path.join(ccsDir, `${apiName}.settings.json`);
    if (!fs.existsSync(settingsPath)) return false;

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const token = settings?.env?.ANTHROPIC_AUTH_TOKEN || '';
    return token.length > 0 && !token.includes('YOUR_') && !token.includes('your-');
  } catch {
    return false;
  }
}

/**
 * List all API profiles
 */
export function listApiProfiles(): ApiListResult {
  const profiles: ApiProfileInfo[] = [];
  const variants: CliproxyVariantInfo[] = [];

  if (isUnifiedMode()) {
    const unifiedConfig = loadOrCreateUnifiedConfig();
    for (const name of Object.keys(unifiedConfig.profiles)) {
      profiles.push({
        name,
        settingsPath: 'config.yaml',
        isConfigured: isApiProfileConfigured(name),
        configSource: 'unified',
      });
    }
    // CLIProxy variants
    for (const [name, variant] of Object.entries(unifiedConfig.cliproxy?.variants || {})) {
      variants.push({
        name,
        provider: variant?.provider || 'unknown',
        settings: variant?.settings || '-',
      });
    }
  } else {
    const config = loadConfig();
    for (const [name, settingsPath] of Object.entries(config.profiles)) {
      profiles.push({
        name,
        settingsPath: settingsPath as string,
        isConfigured: isApiProfileConfigured(name),
        configSource: 'legacy',
      });
    }
    // CLIProxy variants
    if (config.cliproxy) {
      for (const [name, v] of Object.entries(config.cliproxy)) {
        const variant = v as { provider: string; settings: string };
        variants.push({
          name,
          provider: variant.provider,
          settings: variant.settings,
        });
      }
    }
  }

  return { profiles, variants };
}

/**
 * Get list of available API profile names
 */
export function getApiProfileNames(): string[] {
  if (isUnifiedMode()) {
    const config = loadOrCreateUnifiedConfig();
    return Object.keys(config.profiles);
  }
  const config = loadConfig();
  return Object.keys(config.profiles);
}

/**
 * Check if using unified config mode
 */
export function isUsingUnifiedConfig(): boolean {
  return isUnifiedMode();
}
