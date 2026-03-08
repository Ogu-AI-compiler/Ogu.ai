import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * FS002 — feature-versioned
 * Feature store feature groups must use versioning to support backward-compatible
 * feature evolution without breaking downstream consumers.
 *
 * Why:
 * - Models trained on feature_group v1 depend on specific feature semantics.
 *   If features are silently updated in-place, the model's assumptions are
 *   violated: "age" might change from int (years) to float (decimal years),
 *   or "revenue" might change from raw to log-transformed.
 * - Feature versioning enables A/B testing of feature definitions:
 *   Team A uses v1 features, Team B uses v2 features, both can run
 *   simultaneously without conflict.
 * - Version history documents what changed: a version bump from v1 to v2
 *   triggers automated re-training of all models using that feature group.
 *   Without versioning, re-training must be triggered manually after every
 *   feature change — and is often forgotten.
 * - Feast, Hopsworks, and Tecton all support feature group versioning.
 *   Declaring version in spec aligns the code with these systems.
 *
 * Escape hatch: add "versioningExternal": true to feature-store-spec.json
 * if versioning is managed by the feature store platform (Feast registry).
 */

export async function run({ dir }) {
  const specPath = join(dir, 'feature-store-spec.json');

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'FS002', message: 'feature-store-spec.json not readable' }; }

  if (spec.versioningExternal === true) {
    return { pass: true, code: 'FS002', message: 'Versioning managed by feature store platform', skipped: true };
  }

  if (!spec.version) {
    return {
      pass: false, code: 'FS002',
      message: 'Feature group has no version declared in spec',
      detail: 'Add to feature-store-spec.json:\n' +
        '  "version": 1\n\n' +
        'Increment version when features change semantics:\n' +
        '  v1 → v2: added new feature column\n' +
        '  v2 → v3: changed normalization of existing feature\n\n' +
        'Use in code:\n  FeatureGroup(name="user_features", version=1)',
    };
  }

  if (typeof spec.version !== 'number' || spec.version < 1) {
    return {
      pass: false, code: 'FS002',
      message: `version must be a positive integer, got: ${JSON.stringify(spec.version)}`,
    };
  }

  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) {
    return { pass: true, code: 'FS002', message: `Feature group v${spec.version} — no code to verify`, skipped: true };
  }

  const content = pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const hasVersion = /version\s*=\s*\d+|VERSION\s*=\s*\d+|v\d+/.test(content);

  if (!hasVersion) {
    return {
      pass: false, code: 'FS002',
      message: `Feature group version=${spec.version} in spec but not referenced in Python code`,
      detail: `Add version to feature group registration:\n  FeatureGroup(name="features", version=${spec.version})`,
    };
  }

  return { pass: true, code: 'FS002', message: `Feature group versioning: v${spec.version}` };
}
