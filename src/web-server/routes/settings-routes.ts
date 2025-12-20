/**
 * Settings Routes - Settings and preset management
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir, loadSettings } from '../../utils/config-manager';
import { isSensitiveKey, maskSensitiveValue } from '../../utils/sensitive-keys';
import type { Settings } from '../../types/config';

const router = Router();

/**
 * Helper: Mask API keys in settings
 */
function maskApiKeys(settings: Settings): Settings {
  if (!settings.env) return settings;

  const masked = { ...settings, env: { ...settings.env } };

  for (const key of Object.keys(masked.env)) {
    if (isSensitiveKey(key)) {
      masked.env[key] = maskSensitiveValue(masked.env[key]);
    }
  }

  return masked;
}

/**
 * GET /api/settings/:profile - Get settings with masked API keys
 */
router.get('/:profile', (req: Request, res: Response): void => {
  const { profile } = req.params;
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  if (!fs.existsSync(settingsPath)) {
    res.status(404).json({ error: 'Settings not found' });
    return;
  }

  const stat = fs.statSync(settingsPath);
  const settings = loadSettings(settingsPath);
  const masked = maskApiKeys(settings);

  res.json({
    profile,
    settings: masked,
    mtime: stat.mtime.getTime(),
    path: settingsPath,
  });
});

/**
 * GET /api/settings/:profile/raw - Get full settings (for editing)
 */
router.get('/:profile/raw', (req: Request, res: Response): void => {
  const { profile } = req.params;
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  if (!fs.existsSync(settingsPath)) {
    res.status(404).json({ error: 'Settings not found' });
    return;
  }

  const stat = fs.statSync(settingsPath);
  const settings = loadSettings(settingsPath);

  res.json({
    profile,
    settings,
    mtime: stat.mtime.getTime(),
    path: settingsPath,
  });
});

/**
 * PUT /api/settings/:profile - Update settings with conflict detection and backup
 */
router.put('/:profile', (req: Request, res: Response): void => {
  const { profile } = req.params;
  const { settings, expectedMtime } = req.body;
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  const fileExists = fs.existsSync(settingsPath);

  // Only check conflict if file exists and expectedMtime was provided
  if (fileExists && expectedMtime) {
    const stat = fs.statSync(settingsPath);
    if (stat.mtime.getTime() !== expectedMtime) {
      res.status(409).json({
        error: 'File modified externally',
        currentMtime: stat.mtime.getTime(),
      });
      return;
    }
  }

  // Create backup only if file exists
  let backupPath: string | undefined;
  if (fileExists) {
    const backupDir = path.join(ccsDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = path.join(backupDir, `${profile}.${timestamp}.settings.json`);
    fs.copyFileSync(settingsPath, backupPath);
  }

  // Ensure directory exists for new files
  if (!fileExists) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  }

  // Write new settings atomically
  const tempPath = settingsPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2) + '\n');
  fs.renameSync(tempPath, settingsPath);

  const newStat = fs.statSync(settingsPath);
  res.json({
    profile,
    mtime: newStat.mtime.getTime(),
    backupPath,
    created: !fileExists,
  });
});

// ==================== Presets ====================

/**
 * GET /api/settings/:profile/presets - Get saved presets for a provider
 */
router.get('/:profile/presets', (req: Request, res: Response): void => {
  const { profile } = req.params;
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  if (!fs.existsSync(settingsPath)) {
    res.json({ presets: [] });
    return;
  }

  const settings = loadSettings(settingsPath);
  res.json({ presets: settings.presets || [] });
});

/**
 * POST /api/settings/:profile/presets - Create a new preset
 */
router.post('/:profile/presets', (req: Request, res: Response): void => {
  const { profile } = req.params;
  const { name, default: defaultModel, opus, sonnet, haiku } = req.body;

  if (!name || !defaultModel) {
    res.status(400).json({ error: 'Missing required fields: name, default' });
    return;
  }

  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  // Create settings file if it doesn't exist
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({ env: {}, presets: [] }, null, 2) + '\n');
  }

  const settings = loadSettings(settingsPath);
  settings.presets = settings.presets || [];

  // Check for duplicate name
  if (settings.presets.some((p) => p.name === name)) {
    res.status(409).json({ error: 'Preset with this name already exists' });
    return;
  }

  const preset = {
    name,
    default: defaultModel,
    opus: opus || defaultModel,
    sonnet: sonnet || defaultModel,
    haiku: haiku || defaultModel,
  };

  settings.presets.push(preset);
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  res.status(201).json({ preset });
});

/**
 * DELETE /api/settings/:profile/presets/:name - Delete a preset
 */
router.delete('/:profile/presets/:name', (req: Request, res: Response): void => {
  const { profile, name } = req.params;
  const ccsDir = getCcsDir();
  const settingsPath = path.join(ccsDir, `${profile}.settings.json`);

  if (!fs.existsSync(settingsPath)) {
    res.status(404).json({ error: 'Settings not found' });
    return;
  }

  const settings = loadSettings(settingsPath);
  if (!settings.presets || !settings.presets.some((p) => p.name === name)) {
    res.status(404).json({ error: 'Preset not found' });
    return;
  }

  settings.presets = settings.presets.filter((p) => p.name !== name);
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  res.json({ success: true });
});

export default router;
