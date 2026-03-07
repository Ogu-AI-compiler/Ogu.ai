import { join, isAbsolute } from 'node:path';

export function getOguRoot(root) {
  const base = process.env.OGU_DIR || '.ogu';
  return isAbsolute(base) ? base : join(root, base);
}

export function getRuntimeRoot(root) {
  const override = process.env.OGU_RUNTIME_DIR || process.env.OGU_STATE_DIR;
  if (override) {
    return isAbsolute(override) ? override : join(root, override);
  }
  if (process.env.OGU_RUNTIME_SPLIT === '1') {
    return join(getOguRoot(root), 'runtime');
  }
  return getOguRoot(root);
}

export function resolveOguPath(root, ...parts) {
  return join(getOguRoot(root), ...parts);
}

export function resolveRuntimePath(root, ...parts) {
  return join(getRuntimeRoot(root), ...parts);
}

export function getRunnersDir(root) {
  return resolveRuntimePath(root, 'runners');
}

export function getSessionsDir(root) {
  return resolveRuntimePath(root, 'sessions');
}

export function getAgentsDir(root) {
  return resolveRuntimePath(root, 'agents');
}

export function getUploadsDir(root) {
  return resolveRuntimePath(root, 'uploads');
}

export function getAuditDir(root) {
  return resolveRuntimePath(root, 'audit');
}

export function getBudgetDir(root) {
  return resolveRuntimePath(root, 'budget');
}

export function getStateDir(root) {
  return resolveRuntimePath(root, 'state');
}

export function getProjectsDir(root) {
  return resolveRuntimePath(root, 'projects');
}

export function getLogsDir(root) {
  return resolveRuntimePath(root, 'logs');
}

export function getLocksDir(root) {
  return resolveRuntimePath(root, 'locks');
}

export function getReportsDir(root) {
  return resolveRuntimePath(root, 'reports');
}

export function getSnapshotsDir(root) {
  return resolveRuntimePath(root, 'snapshots');
}

export function getOrchestrateDir(root) {
  return resolveRuntimePath(root, 'orchestrate');
}

export function getMemoryDir(root) {
  return resolveRuntimePath(root, 'memory');
}

export function getMetricsDir(root) {
  return resolveRuntimePath(root, 'metrics');
}

export function getCacheDir(root) {
  return resolveRuntimePath(root, 'cache');
}

export function getCheckpointsDir(root) {
  return resolveRuntimePath(root, 'checkpoints');
}

export function getArtifactsDir(root) {
  return resolveRuntimePath(root, 'artifacts');
}

export function getAttestationsDir(root) {
  return resolveRuntimePath(root, 'attestations');
}

export function getMarketplaceDir(root) {
  return resolveRuntimePath(root, 'marketplace');
}

export function getContextDir(root) {
  return resolveRuntimePath(root, 'context');
}

export function getGateFeedbackDir(root) {
  return resolveRuntimePath(root, 'gate-feedback');
}
