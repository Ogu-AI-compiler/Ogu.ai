/**
 * AoaS Workspace Resolver
 * Resolves per-user workspace path.
 * - Local: ~/OguWorkspaces/{userId}/
 * - Fly: /home/user/ (isolated per container — DEPLOYMENT_MODE=fly)
 */
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawnSync } from 'child_process';

/**
 * Resolve workspace path for a user.
 * Returns absolute path string.
 */
export function resolveWorkspace(userId) {
  if (!userId) throw new Error('userId is required');
  if ((process.env.DEPLOYMENT_MODE || 'local') === 'fly') {
    // On Fly.io each Machine is dedicated to one user
    return '/home/user';
  }
  return join(homedir(), 'OguWorkspaces', userId);
}

/**
 * Initialize workspace if it doesn't have .ogu structure.
 * Runs `ogu init` once.
 */
export function initWorkspace(userId) {
  const workspacePath = resolveWorkspace(userId);
  mkdirSync(workspacePath, { recursive: true });

  const oguStateFile = join(workspacePath, '.ogu', 'STATE.json');
  if (!existsSync(oguStateFile)) {
    // Find ogu CLI
    const cliCandidates = [
      join(process.cwd(), 'tools/ogu/cli.mjs'),
      join(homedir(), '.ogu/cli.mjs'),
    ];
    const cli = cliCandidates.find(c => existsSync(c));
    if (cli) {
      spawnSync('node', [cli, 'init'], {
        cwd: workspacePath,
        env: { ...process.env, OGU_ROOT: workspacePath },
        stdio: 'ignore',
        timeout: 15000,
      });
    } else {
      // Minimal init: just create .ogu directory
      mkdirSync(join(workspacePath, '.ogu'), { recursive: true });
    }
  }

  return workspacePath;
}

/**
 * Get workspace path, initializing if needed.
 */
export function getOrCreateWorkspace(userId) {
  return initWorkspace(userId);
}
