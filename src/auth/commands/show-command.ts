/**
 * Show Command Handler
 *
 * Shows details for a specific profile.
 */

import * as fs from 'fs';
import * as path from 'path';
import { initUI, header, color, fail, table } from '../../utils/ui';
import { exitWithError } from '../../errors';
import { ExitCode } from '../../errors/exit-codes';
import { CommandContext, ProfileOutput, parseArgs } from './types';

/**
 * Handle the show command
 */
export async function handleShow(ctx: CommandContext, args: string[]): Promise<void> {
  await initUI();
  const { profileName, json } = parseArgs(args);

  if (!profileName) {
    console.log(fail('Profile name is required'));
    console.log('');
    console.log(`Usage: ${color('ccs auth show <profile> [--json]', 'command')}`);
    exitWithError('Profile name is required', ExitCode.PROFILE_ERROR);
  }

  try {
    const profile = ctx.registry.getProfile(profileName);
    const defaultProfile = ctx.registry.getDefaultProfile();
    const isDefault = profileName === defaultProfile;
    const instancePath = ctx.instanceMgr.getInstancePath(profileName);

    // Count sessions
    let sessionCount = 0;
    try {
      const sessionsDir = path.join(instancePath, 'session-env');
      if (fs.existsSync(sessionsDir)) {
        const files = fs.readdirSync(sessionsDir);
        sessionCount = files.filter((f) => f.endsWith('.json')).length;
      }
    } catch (_e) {
      // Ignore errors counting sessions
    }

    // JSON output mode
    if (json) {
      const output: ProfileOutput = {
        name: profileName,
        type: profile.type || 'account',
        is_default: isDefault,
        created: profile.created,
        last_used: profile.last_used || null,
        instance_path: instancePath,
        session_count: sessionCount,
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Human-readable output
    const defaultBadge = isDefault ? color(' (default)', 'success') : '';
    console.log(header(`Profile: ${profileName}${defaultBadge}`));
    console.log('');

    // Details table
    const details = [
      ['Type', profile.type || 'account'],
      ['Instance', instancePath],
      ['Created', new Date(profile.created).toLocaleString()],
      ['Last Used', profile.last_used ? new Date(profile.last_used).toLocaleString() : 'Never'],
      ['Sessions', `${sessionCount}`],
    ];

    console.log(
      table(details, {
        colWidths: [15, 45],
      })
    );
    console.log('');
  } catch (error) {
    exitWithError((error as Error).message, ExitCode.PROFILE_ERROR);
  }
}
