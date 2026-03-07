import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { FeatureStates } from '../../../contracts/schemas/feature-state.mjs';

/**
 * Phase Detector — unified, single source of truth for lifecycle detection.
 *
 * Resolves the current phase from STATE.json and feature state.
 */

export const PHASE_ORDER = [...FeatureStates];

const LEGACY_STATE_MAP = {
  draft: 'idea',
  specced: 'specified',
  allocated: 'building',
  production: 'deployed',
  monitoring: 'observing',
  optimizing: 'observing',
  deprecated: 'completed',
  suspended: 'paused',
  archived: 'completed',
};

function readJsonSafe(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function detectPhase({ root } = {}) {
  root = root || repoRoot();

  const statePath = join(root, '.ogu/STATE.json');
  const state = readJsonSafe(statePath) || {};

  const feature = state.currentFeature || state.current_feature || null;
  let current = state.phase || 'idea';

  if (feature) {
    const featStatePath = join(root, `.ogu/state/features/${feature}.state.json`);
    const featState = readJsonSafe(featStatePath);
    if (featState?.currentState) current = featState.currentState;
  }

  if (!PHASE_ORDER.includes(current) && LEGACY_STATE_MAP[current]) current = LEGACY_STATE_MAP[current];
  if (!PHASE_ORDER.includes(current)) current = 'idea';
  const phaseIndex = PHASE_ORDER.indexOf(current);

  return { current, feature, phaseIndex };
}

export function isPhaseAfter(phaseA, phaseB) {
  const idxA = PHASE_ORDER.indexOf(phaseA);
  const idxB = PHASE_ORDER.indexOf(phaseB);
  if (idxA < 0 || idxB < 0) return false;
  return idxA > idxB;
}
