/**
 * Variant Routes - CLIProxy variant management (custom profiles)
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir, loadSettings } from '../../utils/config-manager';
import { isReservedName, RESERVED_PROFILE_NAMES } from '../../config/reserved-names';
import type { CLIProxyProvider } from '../../cliproxy/types';
import { readConfigSafe, writeConfig, createCliproxySettings } from './route-helpers';

const router = Router();

/**
 * GET /api/cliproxy - List cliproxy variants
 */
router.get('/', (_req: Request, res: Response) => {
  const config = readConfigSafe();
  const variants = Object.entries(config.cliproxy || {}).map(([name, variant]) => ({
    name,
    provider: variant.provider,
    settings: variant.settings,
    account: variant.account || 'default', // Include account field
  }));

  res.json({ variants });
});

/**
 * POST /api/cliproxy - Create cliproxy variant
 */
router.post('/', (req: Request, res: Response): void => {
  const { name, provider, model, account } = req.body;

  if (!name || !provider) {
    res.status(400).json({ error: 'Missing required fields: name, provider' });
    return;
  }

  // Reject reserved names as variant names (prevents collision with built-in providers)
  if (isReservedName(name)) {
    res.status(400).json({
      error: `Cannot use reserved name '${name}' as variant name`,
      reserved: RESERVED_PROFILE_NAMES,
    });
    return;
  }

  const config = readConfigSafe();
  config.cliproxy = config.cliproxy || {};

  if (config.cliproxy[name]) {
    res.status(409).json({ error: 'Variant already exists' });
    return;
  }

  // Ensure .ccs directory exists
  if (!fs.existsSync(getCcsDir())) {
    fs.mkdirSync(getCcsDir(), { recursive: true });
  }

  // Create settings file for variant
  const settingsPath = createCliproxySettings(name, provider as CLIProxyProvider, model);

  // Include account if specified (defaults to 'default' if not provided)
  config.cliproxy[name] = {
    provider,
    settings: settingsPath,
    ...(account && { account }),
  };
  writeConfig(config);

  res.status(201).json({ name, provider, settings: settingsPath, account: account || 'default' });
});

/**
 * PUT /api/cliproxy/:name - Update cliproxy variant
 */
router.put('/:name', (req: Request, res: Response): void => {
  const { name } = req.params;
  const { provider, account, model } = req.body;

  const config = readConfigSafe();

  if (!config.cliproxy?.[name]) {
    res.status(404).json({ error: 'Variant not found' });
    return;
  }

  const variant = config.cliproxy[name];

  // Update fields if provided
  if (provider) {
    variant.provider = provider;
  }
  if (account !== undefined) {
    if (account) {
      variant.account = account;
    } else {
      delete variant.account; // Remove account to use default
    }
  }

  // Update model in settings file if provided
  if (model !== undefined) {
    const settingsPath = path.join(getCcsDir(), `${name}.settings.json`);
    if (fs.existsSync(settingsPath)) {
      const settings = loadSettings(settingsPath);
      if (model) {
        settings.env = settings.env || {};
        settings.env.ANTHROPIC_MODEL = model;
      } else if (settings.env) {
        delete settings.env.ANTHROPIC_MODEL;
      }
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    }
  }

  writeConfig(config);

  res.json({
    name,
    provider: variant.provider,
    account: variant.account || 'default',
    settings: variant.settings,
    updated: true,
  });
});

/**
 * DELETE /api/cliproxy/:name - Delete cliproxy variant
 */
router.delete('/:name', (req: Request, res: Response): void => {
  const { name } = req.params;

  const config = readConfigSafe();

  if (!config.cliproxy?.[name]) {
    res.status(404).json({ error: 'Variant not found' });
    return;
  }

  // Never delete settings files for reserved provider names (safety guard)
  if (!isReservedName(name)) {
    // Only delete settings file for non-reserved variant names
    const settingsPath = path.join(getCcsDir(), `${name}.settings.json`);
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }
  }

  delete config.cliproxy[name];
  writeConfig(config);

  res.json({ name, deleted: true });
});

export default router;
