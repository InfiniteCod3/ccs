/**
 * Binary Installer
 * Handles downloading, verifying, and extracting binary.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BinaryManagerConfig } from '../types';
import {
  detectPlatform,
  getDownloadUrl,
  getChecksumsUrl,
  getExecutableName,
} from '../platform-detector';
import { downloadWithRetry } from './downloader';
import { verifyChecksum, computeChecksum } from './verifier';
import { extractArchive } from './extractor';
import { writeInstalledVersion } from './version-cache';
import { ProgressIndicator } from '../../utils/progress-indicator';
import { ok } from '../../utils/ui';

/**
 * Download and install the binary
 */
export async function downloadAndInstall(
  config: BinaryManagerConfig,
  verbose = false
): Promise<void> {
  const platform = detectPlatform(config.version);
  const downloadUrl = getDownloadUrl(config.version);
  const checksumsUrl = getChecksumsUrl(config.version);

  fs.mkdirSync(config.binPath, { recursive: true });
  const archivePath = path.join(config.binPath, `cliproxy-archive.${platform.extension}`);
  const spinner = new ProgressIndicator(`Downloading CLIProxyAPI v${config.version}`);
  spinner.start();

  try {
    const result = await downloadWithRetry(downloadUrl, archivePath, {
      maxRetries: config.maxRetries,
      verbose,
    });
    if (!result.success) {
      spinner.fail('Download failed');
      throw new Error(result.error || 'Download failed after retries');
    }

    spinner.update('Verifying checksum');
    const checksumResult = await verifyChecksum(
      archivePath,
      platform.binaryName,
      checksumsUrl,
      verbose
    );

    if (!checksumResult.valid) {
      spinner.fail('Checksum mismatch');
      fs.unlinkSync(archivePath);
      throw new Error(
        `Checksum mismatch for ${platform.binaryName}\nExpected: ${checksumResult.expected}\n` +
          `Actual:   ${checksumResult.actual}\n\nManual download: ${downloadUrl}`
      );
    }

    spinner.update('Extracting binary');
    await extractArchive(archivePath, config.binPath, platform.extension, verbose);
    spinner.succeed('CLIProxyAPI ready');
    fs.unlinkSync(archivePath);

    const binaryPath = path.join(config.binPath, getExecutableName());
    if (platform.os !== 'windows' && fs.existsSync(binaryPath)) {
      fs.chmodSync(binaryPath, 0o755);
      if (verbose) console.error(`[cliproxy] Set executable permissions: ${binaryPath}`);
    }

    writeInstalledVersion(config.binPath, config.version);
    console.log(ok(`CLIProxyAPI v${config.version} installed successfully`));
  } catch (error) {
    spinner.fail('Installation failed');
    throw error;
  }
}

/** Delete binary (for cleanup or reinstall) */
export function deleteBinary(binPath: string, verbose = false): void {
  const binaryPath = path.join(binPath, getExecutableName());
  if (fs.existsSync(binaryPath)) {
    fs.unlinkSync(binaryPath);
    if (verbose) console.error(`[cliproxy] Deleted: ${binaryPath}`);
  }
}

/** Get binary path */
export function getBinaryPath(binPath: string): string {
  return path.join(binPath, getExecutableName());
}

/** Check if binary exists */
export function isBinaryInstalled(binPath: string): boolean {
  return fs.existsSync(getBinaryPath(binPath));
}

/** Get binary info if installed */
export async function getBinaryInfo(
  binPath: string,
  version: string
): Promise<{
  path: string;
  version: string;
  platform: ReturnType<typeof detectPlatform>;
  checksum: string;
} | null> {
  const binaryPath = getBinaryPath(binPath);
  if (!fs.existsSync(binaryPath)) return null;

  const platform = detectPlatform();
  const checksum = await computeChecksum(binaryPath);
  return { path: binaryPath, version, platform, checksum };
}
