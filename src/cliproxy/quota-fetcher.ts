/**
 * Quota Fetcher for Antigravity Accounts
 *
 * Fetches quota information from Google Cloud Code internal API.
 * Used for displaying remaining quota percentages and reset times.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAuthDir } from './config-generator';
import { CLIProxyProvider } from './types';

/** Individual model quota info */
export interface ModelQuota {
  /** Model name, e.g., "gemini-3-pro-high" */
  name: string;
  /** Display name from API, e.g., "Gemini 3 Pro" */
  displayName?: string;
  /** Remaining quota as percentage (0-100) */
  percentage: number;
  /** ISO timestamp when quota resets, null if unknown */
  resetTime: string | null;
}

/** Quota fetch result */
export interface QuotaResult {
  /** Whether fetch succeeded */
  success: boolean;
  /** Quota for each available model */
  models: ModelQuota[];
  /** Timestamp of fetch */
  lastUpdated: number;
  /** True if account lacks quota access (403) */
  isForbidden?: boolean;
  /** Error message if fetch failed */
  error?: string;
}

/** Google Cloud Code API endpoints */
const ANTIGRAVITY_API_BASE = 'https://cloudcode-pa.googleapis.com';
const ANTIGRAVITY_API_VERSION = 'v1internal';

/** API client headers */
const ANTIGRAVITY_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'antigravity/1.11.5 linux/amd64',
  'X-Goog-Api-Client': 'gl-node/20.9.0',
};

/** Auth file structure */
interface AntigravityAuthFile {
  access_token: string;
  refresh_token?: string;
  email?: string;
  expired?: string;
  expires_in?: number;
  timestamp?: number;
  type?: string;
}

/** loadCodeAssist response */
interface LoadCodeAssistResponse {
  cloudaicompanionProject?: string | { id?: string };
}

/** fetchAvailableModels response model */
interface AvailableModel {
  name?: string;
  displayName?: string;
  quotaInfo?: {
    remainingFraction?: number;
    remaining_fraction?: number;
    remaining?: number;
    resetTime?: string;
    reset_time?: string;
  };
  quota_info?: {
    remainingFraction?: number;
    remaining_fraction?: number;
    remaining?: number;
    resetTime?: string;
    reset_time?: string;
  };
}

/** fetchAvailableModels response */
interface FetchAvailableModelsResponse {
  models?: Record<string, AvailableModel>;
}

/**
 * Read access token from auth file
 */
function readAccessToken(provider: CLIProxyProvider, accountId: string): string | null {
  const authDir = getAuthDir();

  // Account ID format: email with @ and . replaced by _
  // Try to find matching token file
  const files = fs.readdirSync(authDir);
  const prefix = provider === 'agy' ? 'antigravity-' : `${provider}-`;

  for (const file of files) {
    if (file.startsWith(prefix) && file.endsWith('.json')) {
      // Check if this file matches the account ID
      const baseName = file.replace(prefix, '').replace('.json', '');
      if (baseName === accountId || file === accountId || file === `${accountId}.json`) {
        const filePath = path.join(authDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content) as AntigravityAuthFile;
          return data.access_token || null;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Get project ID via loadCodeAssist endpoint
 */
async function getProjectId(accessToken: string): Promise<string | null> {
  const url = `${ANTIGRAVITY_API_BASE}/${ANTIGRAVITY_API_VERSION}:loadCodeAssist`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        ...ANTIGRAVITY_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        metadata: {
          ideType: 'IDE_UNSPECIFIED',
          platform: 'PLATFORM_UNSPECIFIED',
          pluginType: 'GEMINI',
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as LoadCodeAssistResponse;

    // Extract project ID from response
    let projectId: string | undefined;
    if (typeof data.cloudaicompanionProject === 'string') {
      projectId = data.cloudaicompanionProject;
    } else if (typeof data.cloudaicompanionProject === 'object') {
      projectId = data.cloudaicompanionProject?.id;
    }

    return projectId?.trim() || null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Fetch available models with quota info
 */
async function fetchAvailableModels(accessToken: string, projectId: string): Promise<QuotaResult> {
  const url = `${ANTIGRAVITY_API_BASE}/${ANTIGRAVITY_API_VERSION}:fetchAvailableModels`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        ...ANTIGRAVITY_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        project: projectId,
      }),
    });

    clearTimeout(timeoutId);

    if (response.status === 403) {
      return {
        success: false,
        models: [],
        lastUpdated: Date.now(),
        isForbidden: true,
        error: 'Quota access forbidden for this account',
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        models: [],
        lastUpdated: Date.now(),
        error: 'Access token expired or invalid',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        models: [],
        lastUpdated: Date.now(),
        error: `API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as FetchAvailableModelsResponse;
    const models: ModelQuota[] = [];

    if (data.models && typeof data.models === 'object') {
      for (const [modelId, modelData] of Object.entries(data.models)) {
        const quotaInfo = modelData.quotaInfo || modelData.quota_info;
        if (!quotaInfo) continue;

        // Extract remaining fraction (0-1 range)
        const remaining =
          quotaInfo.remainingFraction ?? quotaInfo.remaining_fraction ?? quotaInfo.remaining;

        if (typeof remaining !== 'number') continue;

        // Convert to percentage (0-100)
        const percentage = Math.round(remaining * 100);

        // Extract reset time
        const resetTime = quotaInfo.resetTime || quotaInfo.reset_time || null;

        models.push({
          name: modelId,
          displayName: modelData.displayName,
          percentage,
          resetTime,
        });
      }
    }

    return {
      success: true,
      models,
      lastUpdated: Date.now(),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      success: false,
      models: [],
      lastUpdated: Date.now(),
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Fetch quota for an Antigravity account
 *
 * @param provider - Provider name (only 'agy' supported)
 * @param accountId - Account identifier (email with _ replacing @ and .)
 * @returns Quota result with models and percentages
 */
export async function fetchAccountQuota(
  provider: CLIProxyProvider,
  accountId: string
): Promise<QuotaResult> {
  // Only Antigravity supports quota fetching
  if (provider !== 'agy') {
    return {
      success: false,
      models: [],
      lastUpdated: Date.now(),
      error: `Quota not supported for provider: ${provider}`,
    };
  }

  // Read access token from auth file
  const accessToken = readAccessToken(provider, accountId);
  if (!accessToken) {
    return {
      success: false,
      models: [],
      lastUpdated: Date.now(),
      error: 'Access token not found for account',
    };
  }

  // Get project ID first
  const projectId = await getProjectId(accessToken);
  if (!projectId) {
    return {
      success: false,
      models: [],
      lastUpdated: Date.now(),
      error: 'Failed to retrieve project ID',
    };
  }

  // Fetch models with quota
  return fetchAvailableModels(accessToken, projectId);
}
