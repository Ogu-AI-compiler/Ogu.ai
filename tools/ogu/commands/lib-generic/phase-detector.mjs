import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Phase Detector — unified, single source of truth for pipeline phase detection.
 *
 * Resolves the current phase from STATE.json, feature state, and file system signals.
 * Used by both CLI and Studio to ensure consistent phase detection.
 */

export const PHASE_ORDER = [
  'idea',
  'feature',
  'architect',
  'design',
  'preflight',
  'lock',
  'build',
  'verify-ui',
  'smoke',
  'vision',
  'enforce',
  'preview',
  'done',
  'observe',
];

/**
 * Detect the current pipeline phase.
 *
 * @param {object} opts
 * @param {string} [opts.root]
 * @returns {{ current: string, feature: string|null, phaseIndex: number }}
 */
export function detectPhase({ root } = {}) {
  root = root || repoRoot();

  // Read STATE.json
  let state = {};
  const statePath = join(root, '.ogu/STATE.json');
  if (existsSync(statePath)) {
    try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch { /* empty */ }
  }

  const feature = state.currentFeature || null;
  let current = state.phase || 'idea';

  // If we have a feature, check feature-specific state
  if (feature) {
    const featStatePath = join(root, `.ogu/state/features/${feature}.json`);
    if (existsSync(featStatePath)) {
      try {
        const featState = JSON.parse(readFileSync(featStatePath, 'utf8'));
        if (featState.phase) current = featState.phase;
      } catch { /* empty */ }
    }
  }

  const phaseIndex = PHASE_ORDER.indexOf(current);

  return { current, feature, phaseIndex };
}

/**
 * Check if phaseA comes after phaseB in the pipeline.
 *
 * @param {string} phaseA
 * @param {string} phaseB
 * @returns {boolean}
 */
export function isPhaseAfter(phaseA, phaseB) {
  const idxA = PHASE_ORDER.indexOf(phaseA);
  const idxB = PHASE_ORDER.indexOf(phaseB);
  if (idxA < 0 || idxB < 0) return false;
  return idxA > idxB;
}
