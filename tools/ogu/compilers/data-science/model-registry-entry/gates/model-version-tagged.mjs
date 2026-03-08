import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MR005 — model-version-tagged
 * Model registry entries must use semantic versioning with a "stage" tag
 * (staging/production/archived) to manage the model lifecycle.
 *
 * Why:
 * - Model versioning is different from code versioning: models can be in
 *   "staging" (deployed to test environment, not production) vs "production"
 *   (serving real traffic) vs "archived" (superseded, not running).
 * - Without stage tags, it's impossible to answer: "which model version is
 *   currently in production?" or "what was deployed when incident X occurred?"
 * - Semantic versioning (MAJOR.MINOR.PATCH) communicates breaking changes:
 *   - MAJOR: input/output schema changed (breaking for consumers)
 *   - MINOR: retrained with new data, same schema
 *   - PATCH: threshold tuned, metadata updated
 * - MLflow, BentoML, Seldon, and other serving frameworks have native
 *   stage management — this gate verifies the spec aligns with those systems.
 *
 * Required: model_version matching semver pattern, stage in valid set.
 */

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/;
const VERSION_PREFIX_RE = /^v?\d+\.\d+\.\d+(?:-[\w.]+)?$/;
const VALID_STAGES = new Set(['development', 'staging', 'production', 'archived', 'champion', 'challenger', 'shadow']);

export async function run({ dir }) {
  const metaPath = join(dir, 'model-metadata.json');
  if (!existsSync(metaPath)) {
    return { pass: false, code: 'MR005', message: 'model-metadata.json not found' };
  }

  let meta;
  try { meta = JSON.parse(readFileSync(metaPath, 'utf8')); }
  catch { return { pass: false, code: 'MR005', message: 'model-metadata.json not parseable' }; }

  const version = meta.model_version ?? meta.version;
  const stage   = meta.stage ?? meta.model_stage ?? meta.lifecycle_stage;

  const issues = [];

  if (!version) {
    issues.push('Missing model_version — add "model_version": "v1.2.0"');
  } else {
    const versionStr = String(version).replace(/^v/, '');
    if (!SEMVER_RE.test(versionStr)) {
      issues.push(`model_version "${version}" is not semantic versioning — use "v1.2.0" or "1.2.0"`);
    }
  }

  if (!stage) {
    issues.push(`Missing stage — add "stage": one of: ${[...VALID_STAGES].join(', ')}`);
  } else if (!VALID_STAGES.has(String(stage).toLowerCase())) {
    issues.push(`stage "${stage}" is not a valid lifecycle stage — valid: ${[...VALID_STAGES].join(', ')}`);
  }

  if (issues.length) {
    return {
      pass: false, code: 'MR005',
      message: `${issues.length} versioning issue(s)`,
      detail: issues.join('\n') + '\n\nVersion semantics:\n  MAJOR.minor.patch\n  MAJOR = breaking schema change\n  minor = retrain with new data\n  patch = threshold/metadata update',
    };
  }

  return {
    pass: true, code: 'MR005',
    message: `Version ${version} — stage: ${stage}`,
  };
}
