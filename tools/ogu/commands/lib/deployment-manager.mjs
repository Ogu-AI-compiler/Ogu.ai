/**
 * Deployment Manager — build artifacts and orchestrate rollout.
 */

import { randomUUID } from 'node:crypto';

export const DEPLOY_STATUSES = ['pending', 'deploying', 'deployed', 'rolled_back', 'failed'];

/**
 * Create a deployment manager.
 *
 * @returns {object} Manager with createDeployment/getDeployment/promote/rollback/listDeployments
 */
export function createDeploymentManager() {
  const deployments = new Map();

  function createDeployment({ version, artifacts = [], environment = 'production' }) {
    const id = randomUUID().slice(0, 8);
    deployments.set(id, {
      id,
      version,
      artifacts,
      environment,
      status: 'pending',
      createdAt: new Date().toISOString(),
      deployedAt: null,
      rolledBackAt: null,
    });
    return id;
  }

  function getDeployment(id) {
    return deployments.get(id) || null;
  }

  function promote(id) {
    const dep = deployments.get(id);
    if (!dep) throw new Error(`Deployment ${id} not found`);
    dep.status = 'deployed';
    dep.deployedAt = new Date().toISOString();
  }

  function rollback(id) {
    const dep = deployments.get(id);
    if (!dep) throw new Error(`Deployment ${id} not found`);
    dep.status = 'rolled_back';
    dep.rolledBackAt = new Date().toISOString();
  }

  function listDeployments() {
    return Array.from(deployments.values());
  }

  return { createDeployment, getDeployment, promote, rollback, listDeployments };
}
