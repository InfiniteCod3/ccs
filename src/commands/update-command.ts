/**
 * Update Command Handler
 *
 * Handles `ccs update` command - checks for updates and installs latest version.
 * Supports both npm and direct installation methods.
 */

import { spawn } from 'child_process';
import { colored } from '../utils/helpers';
import { detectInstallationMethod, detectPackageManager } from '../utils/package-manager-detector';
import { compareVersionsWithPrerelease } from '../utils/update-checker';
import { getVersion } from '../utils/version';

/**
 * Options for the update command
 */
export interface UpdateOptions {
  force?: boolean;
  beta?: boolean;
}

// Version (from centralized utility)
const CCS_VERSION = getVersion();

/**
 * Handle the update command
 * Checks for updates and installs the latest version
 */
export async function handleUpdateCommand(options: UpdateOptions = {}): Promise<void> {
  const { force = false, beta = false } = options;
  const targetTag = beta ? 'dev' : 'latest';

  console.log('');
  console.log(colored('Checking for updates...', 'cyan'));
  console.log('');

  const installMethod = detectInstallationMethod();
  const isNpmInstall = installMethod === 'npm';

  // Force reinstall - skip update check
  if (force) {
    console.log(colored(`[i] Force reinstall from @${targetTag} channel...`, 'cyan'));
    console.log('');

    if (isNpmInstall) {
      await performNpmUpdate(targetTag, true);
    } else {
      // Direct install doesn't support --beta
      if (beta) {
        handleDirectBetaNotSupported();
        return;
      }
      await performDirectUpdate();
    }
    return;
  }

  const { checkForUpdates } = await import('../utils/update-checker');

  const updateResult = await checkForUpdates(CCS_VERSION, true, installMethod, targetTag);

  if (updateResult.status === 'check_failed') {
    handleCheckFailed(updateResult.message ?? 'Update check failed', isNpmInstall, targetTag);
    return;
  }

  if (updateResult.status === 'no_update') {
    handleNoUpdate(updateResult.reason);
    return;
  }

  // Update available
  console.log(
    colored(`[i] Update available: ${updateResult.current} -> ${updateResult.latest}`, 'yellow')
  );
  console.log('');

  // Check if this is a downgrade (e.g., stable to older dev)
  const isDowngrade =
    updateResult.latest &&
    updateResult.current &&
    compareVersionsWithPrerelease(updateResult.latest, updateResult.current) < 0;

  // This happens when stable user requests @dev but @dev base is older
  if (isDowngrade && beta) {
    console.log(
      colored(
        '[!] WARNING: Downgrading from ' +
          (updateResult.current || 'unknown') +
          ' to ' +
          (updateResult.latest || 'unknown'),
        'yellow'
      )
    );
    console.log(colored('[!] Dev channel may be behind stable.', 'yellow'));
    console.log('');
  }

  // Show beta warning
  if (beta) {
    console.log(colored('[!] Installing from @dev channel (unstable)', 'yellow'));
    console.log(colored('[!] Not recommended for production use', 'yellow'));
    console.log(colored('[!] Use `ccs update` (without --beta) to return to stable', 'cyan'));
    console.log('');
  }

  if (isNpmInstall) {
    await performNpmUpdate(targetTag);
  } else {
    await performDirectUpdate();
  }
}

/**
 * Handle failed update check
 */
function handleCheckFailed(
  message: string,
  isNpmInstall: boolean,
  targetTag: string = 'latest'
): void {
  console.log(colored(`[X] ${message}`, 'red'));
  console.log('');
  console.log(colored('[i] Possible causes:', 'yellow'));
  console.log('  - Network connection issues');
  console.log('  - Firewall blocking requests');
  console.log('  - GitHub/npm API temporarily unavailable');
  console.log('');
  console.log('Try again later or update manually:');

  if (isNpmInstall) {
    const packageManager = detectPackageManager();
    let manualCommand: string;

    switch (packageManager) {
      case 'npm':
        manualCommand = `npm install -g @kaitranntt/ccs@${targetTag}`;
        break;
      case 'yarn':
        manualCommand = `yarn global add @kaitranntt/ccs@${targetTag}`;
        break;
      case 'pnpm':
        manualCommand = `pnpm add -g @kaitranntt/ccs@${targetTag}`;
        break;
      case 'bun':
        manualCommand = `bun add -g @kaitranntt/ccs@${targetTag}`;
        break;
      default:
        manualCommand = `npm install -g @kaitranntt/ccs@${targetTag}`;
    }

    console.log(colored(`  ${manualCommand}`, 'yellow'));
  } else {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      console.log(colored('  irm ccs.kaitran.ca/install | iex', 'yellow'));
    } else {
      console.log(colored('  curl -fsSL ccs.kaitran.ca/install | bash', 'yellow'));
    }
  }
  console.log('');
  process.exit(1);
}

/**
 * Handle no update available
 */
function handleNoUpdate(reason: string | undefined): void {
  const version = getVersion();

  let message = `You are already on the latest version (${version})`;

  switch (reason) {
    case 'dismissed':
      message = `Update dismissed. You are on version ${version}`;
      console.log(colored(`[i] ${message}`, 'yellow'));
      break;
    case 'cached':
      message = `No updates available (cached result). You are on version ${version}`;
      console.log(colored(`[i] ${message}`, 'cyan'));
      break;
    default:
      console.log(colored(`[OK] ${message}`, 'green'));
  }
  console.log('');
  process.exit(0);
}

/**
 * Perform update via npm/yarn/pnpm/bun
 */
async function performNpmUpdate(
  targetTag: string = 'latest',
  isReinstall: boolean = false
): Promise<void> {
  const packageManager = detectPackageManager();
  let updateCommand: string;
  let updateArgs: string[];
  let cacheCommand: string | null;
  let cacheArgs: string[] | null;

  switch (packageManager) {
    case 'npm':
      updateCommand = 'npm';
      updateArgs = ['install', '-g', `@kaitranntt/ccs@${targetTag}`];
      cacheCommand = 'npm';
      cacheArgs = ['cache', 'clean', '--force'];
      break;
    case 'yarn':
      updateCommand = 'yarn';
      updateArgs = ['global', 'add', `@kaitranntt/ccs@${targetTag}`];
      cacheCommand = 'yarn';
      cacheArgs = ['cache', 'clean'];
      break;
    case 'pnpm':
      updateCommand = 'pnpm';
      updateArgs = ['add', '-g', `@kaitranntt/ccs@${targetTag}`];
      cacheCommand = 'pnpm';
      cacheArgs = ['store', 'prune'];
      break;
    case 'bun':
      updateCommand = 'bun';
      updateArgs = ['add', '-g', `@kaitranntt/ccs@${targetTag}`];
      cacheCommand = null;
      cacheArgs = null;
      break;
    default:
      updateCommand = 'npm';
      updateArgs = ['install', '-g', `@kaitranntt/ccs@${targetTag}`];
      cacheCommand = 'npm';
      cacheArgs = ['cache', 'clean', '--force'];
  }

  console.log(
    colored(`${isReinstall ? 'Reinstalling' : 'Updating'} via ${packageManager}...`, 'cyan')
  );
  console.log('');

  const performUpdate = (): void => {
    const child = spawn(updateCommand, updateArgs, {
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log('');
        console.log(colored(`[OK] ${isReinstall ? 'Reinstall' : 'Update'} successful!`, 'green'));
        console.log('');
        console.log(`Run ${colored('ccs --version', 'yellow')} to verify`);
        console.log('');
      } else {
        console.log('');
        console.log(colored(`[X] ${isReinstall ? 'Reinstall' : 'Update'} failed`, 'red'));
        console.log('');
        console.log('Try manually:');
        console.log(colored(`  ${updateCommand} ${updateArgs.join(' ')}`, 'yellow'));
        console.log('');
      }
      process.exit(code || 0);
    });

    child.on('error', () => {
      console.log('');
      console.log(
        colored(
          `[X] Failed to run ${packageManager} ${isReinstall ? 'reinstall' : 'update'}`,
          'red'
        )
      );
      console.log('');
      console.log('Try manually:');
      console.log(colored(`  ${updateCommand} ${updateArgs.join(' ')}`, 'yellow'));
      console.log('');
      process.exit(1);
    });
  };

  if (cacheCommand && cacheArgs) {
    console.log(colored('Clearing package cache...', 'cyan'));
    const cacheChild = spawn(cacheCommand, cacheArgs, {
      stdio: 'inherit',
    });

    cacheChild.on('exit', (code) => {
      if (code !== 0) {
        console.log(colored('[!] Cache clearing failed, proceeding anyway...', 'yellow'));
      }
      performUpdate();
    });

    cacheChild.on('error', () => {
      console.log(colored('[!] Cache clearing failed, proceeding anyway...', 'yellow'));
      performUpdate();
    });
  } else {
    performUpdate();
  }
}

/**
 * Handle direct install beta not supported error
 */
function handleDirectBetaNotSupported(): void {
  console.log(colored('[X] --beta flag requires npm installation', 'red'));
  console.log('');
  console.log('Current installation method: direct installer');
  console.log('To use beta releases, install via npm:');
  console.log('');
  console.log(colored('  npm install -g @kaitranntt/ccs', 'yellow'));
  console.log(colored('  ccs update --beta', 'yellow'));
  console.log('');
  console.log('Or continue using stable releases via direct installer.');
  console.log('');
  process.exit(1);
}

/**
 * Perform update via direct installer (curl/irm)
 */
async function performDirectUpdate(): Promise<void> {
  console.log(colored('Updating via installer...', 'cyan'));
  console.log('');

  const isWindows = process.platform === 'win32';
  let command: string;
  let args: string[];

  if (isWindows) {
    command = 'powershell.exe';
    args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      'irm ccs.kaitran.ca/install | iex',
    ];
  } else {
    command = '/bin/bash';
    args = ['-c', 'curl -fsSL ccs.kaitran.ca/install | bash'];
  }

  const child = spawn(command, args, {
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    if (code === 0) {
      console.log('');
      console.log(colored('[OK] Update successful!', 'green'));
      console.log('');
      console.log(`Run ${colored('ccs --version', 'yellow')} to verify`);
      console.log('');
    } else {
      console.log('');
      console.log(colored('[X] Update failed', 'red'));
      console.log('');
      console.log('Try manually:');
      if (isWindows) {
        console.log(colored('  irm ccs.kaitran.ca/install | iex', 'yellow'));
      } else {
        console.log(colored('  curl -fsSL ccs.kaitran.ca/install | bash', 'yellow'));
      }
      console.log('');
    }
    process.exit(code || 0);
  });

  child.on('error', () => {
    console.log('');
    console.log(colored('[X] Failed to run installer', 'red'));
    console.log('');
    console.log('Try manually:');
    if (isWindows) {
      console.log(colored('  irm ccs.kaitran.ca/install | iex', 'yellow'));
    } else {
      console.log(colored('  curl -fsSL ccs.kaitran.ca/install | bash', 'yellow'));
    }
    console.log('');
    process.exit(1);
  });
}
