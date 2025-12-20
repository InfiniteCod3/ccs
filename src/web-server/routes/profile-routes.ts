/**
 * Profile Routes - CRUD operations for user profiles and accounts
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir } from '../../utils/config-manager';
import { isReservedName, RESERVED_PROFILE_NAMES } from '../../config/reserved-names';
import {
  readConfigSafe,
  writeConfig,
  isConfigured,
  createSettingsFile,
  updateSettingsFile,
} from './route-helpers';

const router = Router();

// ==================== Profile CRUD ====================

/**
 * GET /api/profiles - List all profiles
 */
router.get('/', (_req: Request, res: Response) => {
  const config = readConfigSafe();
  const profiles = Object.entries(config.profiles).map(([name, settingsPath]) => ({
    name,
    settingsPath,
    configured: isConfigured(name, config),
  }));

  res.json({ profiles });
});

/**
 * POST /api/profiles - Create new profile
 */
router.post('/', (req: Request, res: Response): void => {
  const { name, baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel } = req.body;

  if (!name || !baseUrl || !apiKey) {
    res.status(400).json({ error: 'Missing required fields: name, baseUrl, apiKey' });
    return;
  }

  // Validate reserved names
  if (isReservedName(name)) {
    res.status(400).json({
      error: `Profile name '${name}' is reserved`,
      reserved: RESERVED_PROFILE_NAMES,
    });
    return;
  }

  const config = readConfigSafe();

  if (config.profiles[name]) {
    res.status(409).json({ error: 'Profile already exists' });
    return;
  }

  // Ensure .ccs directory exists
  if (!fs.existsSync(getCcsDir())) {
    fs.mkdirSync(getCcsDir(), { recursive: true });
  }

  // Create settings file with model mapping
  const settingsPath = createSettingsFile(name, baseUrl, apiKey, {
    model,
    opusModel,
    sonnetModel,
    haikuModel,
  });

  // Update config
  config.profiles[name] = settingsPath;
  writeConfig(config);

  res.status(201).json({ name, settingsPath });
});

/**
 * PUT /api/profiles/:name - Update profile
 */
router.put('/:name', (req: Request, res: Response): void => {
  const { name } = req.params;
  const { baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel } = req.body;

  const config = readConfigSafe();

  if (!config.profiles[name]) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  try {
    updateSettingsFile(name, { baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel });
    res.json({ name, updated: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/profiles/:name - Delete profile
 */
router.delete('/:name', (req: Request, res: Response): void => {
  const { name } = req.params;

  const config = readConfigSafe();

  if (!config.profiles[name]) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  // Delete settings file
  const settingsPath = path.join(getCcsDir(), `${name}.settings.json`);
  if (fs.existsSync(settingsPath)) {
    fs.unlinkSync(settingsPath);
  }

  // Remove from config
  delete config.profiles[name];
  writeConfig(config);

  res.json({ name, deleted: true });
});

// ==================== Accounts ====================

/**
 * GET /api/accounts - List accounts from profiles.json
 */
router.get('/accounts', (_req: Request, res: Response): void => {
  const profilesPath = path.join(getCcsDir(), 'profiles.json');

  if (!fs.existsSync(profilesPath)) {
    res.json({ accounts: [], default: null });
    return;
  }

  const data = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
  const accounts = Object.entries(data.profiles || {}).map(([name, meta]) => {
    const metadata = meta as Record<string, unknown>;
    return {
      name,
      ...metadata,
    };
  });

  res.json({ accounts, default: data.default || null });
});

/**
 * POST /api/accounts/default - Set default account
 */
router.post('/accounts/default', (req: Request, res: Response): void => {
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Missing required field: name' });
    return;
  }

  const profilesPath = path.join(getCcsDir(), 'profiles.json');

  const data = fs.existsSync(profilesPath)
    ? JSON.parse(fs.readFileSync(profilesPath, 'utf8'))
    : { profiles: {} };

  data.default = name;
  fs.writeFileSync(profilesPath, JSON.stringify(data, null, 2) + '\n');

  res.json({ default: name });
});

export default router;
