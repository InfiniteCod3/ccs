/**
 * Binary Lifecycle Manager
 * Handles ensuring binary availability and auto-updates.
 */

import * as fs from 'fs';
import { BinaryManagerConfig } from '../types';
import { checkForUpdates, fetchLatestVersion, isNewerVersion } from './version-checker';
import { downloadAndInstall, deleteBinary, getBinaryPath } from './installer';
import { info } from '../../utils/ui';
import { isCliproxyRunning } from '../stats-fetcher';
import { CLIPROXY_DEFAULT_PORT } from '../config-generator';

/** Log helper */
function log(message: string, verbose: boolean): void {
  if (verbose) console.error(`[cliproxy] ${message}`);
}

/** Handle auto-update when binary exists */
async function handleAutoUpdate(config: BinaryManagerConfig, verbose: boolean): Promise<void> {
  const updateResult = await checkForUpdates(config.binPath, config.version, verbose);
  if (!updateResult.hasUpdate) return;

  const proxyRunning = await isCliproxyRunning(CLIPROXY_DEFAULT_PORT);
  const updateMsg = `CLIProxyAPI update available: v${updateResult.currentVersion} -> v${updateResult.latestVersion}`;

  if (proxyRunning) {
    console.log(info(updateMsg));
    console.log(info('Run "ccs cliproxy stop" then restart to apply update'));
    log('Skipping update: CLIProxyAPI is currently running', verbose);
  } else {
    console.log(info(updateMsg));
    console.log(info('Updating CLIProxyAPI...'));
    deleteBinary(config.binPath, verbose);
    config.version = updateResult.latestVersion;
    await downloadAndInstall(config, verbose);
  }
}

/**
 * Ensure binary is available (download if missing, update if outdated)
 * @returns Path to executable binary
 */
export async function ensureBinary(config: BinaryManagerConfig): Promise<string> {
  const verbose = config.verbose;
  const binaryPath = getBinaryPath(config.binPath);

  // Binary exists - check for updates unless forceVersion
  if (fs.existsSync(binaryPath)) {
    log(`Binary exists: ${binaryPath}`, verbose);

    if (config.forceVersion) {
      log('Force version mode: skipping auto-update', verbose);
      return binaryPath;
    }

    try {
      await handleAutoUpdate(config, verbose);
    } catch (error) {
      const err = error as Error;
      log(`Update check failed (non-blocking): ${err.message}`, verbose);
    }

    return binaryPath;
  }

  // Binary missing - download
  log('Binary not found, downloading...', verbose);

  if (!config.forceVersion) {
    try {
      const latestVersion = await fetchLatestVersion(verbose);
      if (latestVersion && isNewerVersion(latestVersion, config.version)) {
        log(`Using latest version: ${latestVersion} (instead of ${config.version})`, verbose);
        config.version = latestVersion;
      }
    } catch {
      log(`Using pinned version: ${config.version}`, verbose);
    }
  } else {
    log(`Force version mode: using specified version ${config.version}`, verbose);
  }

  await downloadAndInstall(config, verbose);
  return binaryPath;
}
