/**
 * AoaS Orchestrator Interface
 * Abstracts over deployment environments.
 * DEPLOYMENT_MODE=local|fly
 */
import { resolveWorkspace, initWorkspace } from '../workspace/resolver.mjs';

/**
 * @interface Orchestrator
 *   getOrCreateWorkspace(userId: string): Promise<WorkspaceInfo>
 *   suspendWorkspace(userId: string): Promise<void>
 *   resumeWorkspace(userId: string): Promise<void>
 *   getWorkspaceStatus(userId: string): Promise<'running'|'suspended'|'none'>
 */

class LocalOrchestrator {
  async getOrCreateWorkspace(userId) {
    const path = initWorkspace(userId);
    return { userId, path, mode: 'local', status: 'running' };
  }

  async suspendWorkspace(userId) {
    // No-op locally — workspace is just a directory
    return;
  }

  async resumeWorkspace(userId) {
    // No-op locally
    return;
  }

  async getWorkspaceStatus(userId) {
    const { existsSync } = await import('fs');
    const path = resolveWorkspace(userId);
    return existsSync(path) ? 'running' : 'none';
  }
}

class FlyOrchestrator {
  constructor() {
    this.apiToken = process.env.FLY_API_TOKEN;
    this.appName = process.env.FLY_APP_NAME || 'ogu-aoas';
  }

  async getOrCreateWorkspace(userId) {
    // Stub: in production, call Fly.io Machines API
    const status = await this.getWorkspaceStatus(userId);
    if (status === 'none') {
      // Would call: POST https://api.fly.io/v1/apps/{appName}/machines
      console.log(`[FlyOrchestrator] Would create machine for user: ${userId}`);
    }
    return { userId, path: '/home/user', mode: 'fly', status: 'running', machineId: `mach_${userId.slice(0, 8)}` };
  }

  async suspendWorkspace(userId) {
    // Would call: POST https://api.fly.io/v1/apps/{appName}/machines/{machineId}/stop
    console.log(`[FlyOrchestrator] Would suspend machine for user: ${userId}`);
  }

  async resumeWorkspace(userId) {
    // Would call: POST https://api.fly.io/v1/apps/{appName}/machines/{machineId}/start
    console.log(`[FlyOrchestrator] Would resume machine for user: ${userId}`);
  }

  async getWorkspaceStatus(userId) {
    // Would call: GET https://api.fly.io/v1/apps/{appName}/machines
    // For now: return 'none' as stub
    return 'none';
  }
}

export function createOrchestrator() {
  return process.env.DEPLOYMENT_MODE === 'fly'
    ? new FlyOrchestrator()
    : new LocalOrchestrator();
}

export { LocalOrchestrator, FlyOrchestrator };
