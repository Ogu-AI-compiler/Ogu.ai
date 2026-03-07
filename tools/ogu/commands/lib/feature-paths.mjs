import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

const FEATURE_ROOTS = [
  'docs/vault/features',
  'docs/vault/04_Features',
];

/**
 * Resolve feature directory with fallback between current + legacy vault paths.
 * Defaults to docs/vault/features when neither exists.
 */
export function resolveFeatureDir(root, slug, { preferLegacy = false } = {}) {
  const r = root || repoRoot();
  const roots = preferLegacy ? [...FEATURE_ROOTS].reverse() : FEATURE_ROOTS;
  for (const base of roots) {
    const dir = join(r, base, slug);
    if (existsSync(dir)) return dir;
  }
  return join(r, FEATURE_ROOTS[0], slug);
}

/** Resolve a specific feature file path with fallback roots. */
export function resolveFeatureFile(root, slug, filename, opts = {}) {
  return join(resolveFeatureDir(root, slug, opts), filename);
}

/** Return both candidate feature directories in priority order. */
export function getFeatureDirCandidates(root, slug, { preferLegacy = false } = {}) {
  const r = root || repoRoot();
  const roots = preferLegacy ? [...FEATURE_ROOTS].reverse() : FEATURE_ROOTS;
  return roots.map(base => join(r, base, slug));
}

export const FEATURE_VAULT_ROOTS = [...FEATURE_ROOTS];
