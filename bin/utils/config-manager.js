'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { error, expandPath } = require('./helpers');
const { ErrorManager } = require('./error-manager');

// Get config file path
function getConfigPath() {
  return process.env.CCS_CONFIG || path.join(os.homedir(), '.ccs', 'config.json');
}

// Read and parse config
function readConfig() {
  const configPath = getConfigPath();

  // Check config exists
  if (!fs.existsSync(configPath)) {
    // Attempt recovery
    const RecoveryManager = require('./recovery-manager');
    const recovery = new RecoveryManager();
    recovery.ensureConfigJson();

    if (!fs.existsSync(configPath)) {
      ErrorManager.showInvalidConfig(configPath, 'File not found');
      process.exit(1);
    }
  }

  // Read and parse JSON
  let config;
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configContent);
  } catch (e) {
    ErrorManager.showInvalidConfig(configPath, `Invalid JSON: ${e.message}`);
    process.exit(1);
  }

  // Validate config has profiles object
  if (!config.profiles || typeof config.profiles !== 'object') {
    ErrorManager.showInvalidConfig(configPath, "Missing 'profiles' object");
    process.exit(1);
  }

  return config;
}

// Get settings path for profile
function getSettingsPath(profile) {
  const config = readConfig();

  // Get settings path
  const settingsPath = config.profiles[profile];

  if (!settingsPath) {
    const availableProfiles = Object.keys(config.profiles);
    const profileList = availableProfiles.map(p => `  - ${p}`);
    ErrorManager.showProfileNotFound(profile, profileList);
    process.exit(1);
  }

  // Expand path
  const expandedPath = expandPath(settingsPath);

  // Validate settings file exists
  if (!fs.existsSync(expandedPath)) {
    // Auto-create if it's ~/.claude/settings.json
    if (expandedPath.includes('.claude') && expandedPath.endsWith('settings.json')) {
      const RecoveryManager = require('./recovery-manager');
      const recovery = new RecoveryManager();
      recovery.ensureClaudeSettings();

      if (!fs.existsSync(expandedPath)) {
        ErrorManager.showSettingsNotFound(expandedPath);
        process.exit(1);
      }

      console.log('[i] Auto-created missing settings file');
    } else {
      ErrorManager.showSettingsNotFound(expandedPath);
      process.exit(1);
    }
  }

  // Validate settings file is valid JSON
  try {
    const settingsContent = fs.readFileSync(expandedPath, 'utf8');
    JSON.parse(settingsContent);
  } catch (e) {
    ErrorManager.showInvalidConfig(expandedPath, `Invalid JSON: ${e.message}`);
    process.exit(1);
  }

  return expandedPath;
}

module.exports = {
  getConfigPath,
  readConfig,
  getSettingsPath
};