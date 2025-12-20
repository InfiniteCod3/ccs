/**
 * CLIProxy Proxy Lifecycle Service
 *
 * Handles start/stop/status operations for CLIProxy instances.
 * Delegates to session-tracker for actual process management.
 */

import {
  stopProxy as stopProxySession,
  getProxyStatus as getProxyStatusSession,
} from '../session-tracker';

/** Proxy status result */
export interface ProxyStatusResult {
  running: boolean;
  port?: number;
  pid?: number;
  sessionCount?: number;
  startedAt?: string;
}

/** Stop proxy result */
export interface StopProxyResult {
  stopped: boolean;
  pid?: number;
  sessionCount?: number;
  error?: string;
}

/**
 * Get current proxy status
 */
export function getProxyStatus(): ProxyStatusResult {
  return getProxyStatusSession();
}

/**
 * Stop the running CLIProxy instance
 */
export async function stopProxy(): Promise<StopProxyResult> {
  return stopProxySession();
}

/**
 * Check if proxy is currently running
 */
export function isProxyRunning(): boolean {
  const status = getProxyStatusSession();
  return status.running;
}

/**
 * Get active session count
 */
export function getActiveSessionCount(): number {
  const status = getProxyStatusSession();
  return status.sessionCount ?? 0;
}
