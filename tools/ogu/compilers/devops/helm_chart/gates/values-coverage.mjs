/**
 * Gate: values-coverage (HC006)
 * Checks that every top-level .Values.* key referenced in templates has a
 * corresponding entry in values.yaml. Missing entries cause `helm template`
 * to render empty strings silently, which can produce invalid Kubernetes
 * manifests (e.g. empty image names, missing namespace strings).
 *
 * This gate uses a simple line-based YAML key extractor rather than a full
 * YAML parser — sufficient for top-level key coverage checks in real charts.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Extract top-level keys from values.yaml by scanning lines of the form "key:"
 * This is intentionally simple — we're not running a full YAML parser,
 * but we cover the vast majority of real values.yaml layouts.
 */
function extractValuesKeys(content) {
  const keys = new Set();
  for (const line of content.split('\n')) {
    // Match top-level keys (no leading whitespace) of the form "key:"
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

export async function run({ dir }) {
  const valuesPath   = join(dir, 'values.yaml');
  const templatesDir = join(dir, 'templates');

  if (!existsSync(valuesPath) || !existsSync(templatesDir)) {
    return { pass: true, code: 'HC006', message: 'values.yaml or templates/ missing — skipped', skipped: true };
  }

  const valuesContent = readFileSync(valuesPath, 'utf8');
  const valuesKeys    = extractValuesKeys(valuesContent);

  const templateFiles = readdirSync(templatesDir).filter(f => f.endsWith('.yaml') || f.endsWith('.tpl'));
  if (templateFiles.length === 0) {
    return { pass: true, code: 'HC006', message: 'No template files — skipped', skipped: true };
  }

  const allTemplates = templateFiles
    .map(f => readFileSync(join(templatesDir, f), 'utf8'))
    .join('\n');

  // Correctly match .Values.<key> — top-level key access only
  const refs       = [...allTemplates.matchAll(/\.Values\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map(m => m[1]);
  const uniqueRefs = [...new Set(refs)];
  const missing    = uniqueRefs.filter(key => !valuesKeys.has(key));

  if (missing.length > 0) {
    return {
      pass: false, code: 'HC006',
      message: `${missing.length} .Values key(s) referenced in templates but absent from values.yaml`,
      detail: {
        missing: missing.map(k => `.Values.${k}`),
        hint: 'Add default values for these keys in values.yaml — missing entries render as empty strings',
      },
    };
  }

  return {
    pass: true, code: 'HC006',
    message: `All ${uniqueRefs.length} .Values key reference(s) are covered in values.yaml`,
  };
}
