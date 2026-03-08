import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EC003 — all-hyperparams-documented
 * All hyperparameters in config files must have inline documentation
 * explaining their purpose and recommended range.
 *
 * Why:
 * - Undocumented hyperparameters are opaque: when someone needs to tune
 *   the model, they must reverse-engineer what each parameter does and
 *   what range is reasonable — duplicating knowledge the original author had.
 * - Documentation enables automated HPO: a documented range (min/max)
 *   can be parsed to generate search space configs automatically.
 * - Parameter documentation prevents cargo-cult copying: without knowing
 *   why n_estimators=200 was chosen, the next person will copy it unchanged
 *   even when retraining on a fundamentally different dataset.
 *
 * Required: numeric parameters in YAML/JSON config files must have either:
 * - Inline comment (YAML: "# description [range: X-Y]")
 * - Adjacent documentation key (JSON: "n_estimators_doc": "number of trees [50-500]")
 * - More than 50% of parameters documented (pragmatic threshold)
 *
 * Escape hatch: add "paramsDocumentedExternally": true to experiment-spec.json
 * if all parameters are documented in a companion README or design doc.
 */

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'experiment-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'EC003', message: 'experiment-spec.json not readable' }; }

  if (spec.paramsDocumentedExternally === true) {
    return { pass: true, code: 'EC003', message: 'Parameters documented externally', skipped: true };
  }

  const yamlFiles = readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  const jsonFiles = readdirSync(dir).filter(f =>
    f.endsWith('.json') && f !== 'experiment-spec.json'
  );

  if (!yamlFiles.length && !jsonFiles.length) {
    return { pass: true, code: 'EC003', message: 'No config files found — documentation check skipped', skipped: true };
  }

  // For YAML — check that numeric params have inline comments
  let totalParams = 0;
  let documentedParams = 0;
  const undocumented = [];

  for (const file of yamlFiles) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');
    for (const line of lines) {
      // Numeric parameter line: "  param_name: 123" or "  param: 0.05"
      if (/^\s+\w+:\s+[\d.]+/.test(line)) {
        totalParams++;
        if (/#/.test(line)) {
          documentedParams++;
        } else {
          undocumented.push(`${file}: ${line.trim()}`);
        }
      }
    }
  }

  // For JSON — check for _doc companion keys
  for (const file of jsonFiles) {
    try {
      const obj = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      const keys = Object.keys(obj);
      for (const key of keys) {
        if (typeof obj[key] === 'number') {
          totalParams++;
          const hasDoc = keys.includes(`${key}_doc`) || keys.includes(`${key}_description`) || keys.includes(`${key}_note`);
          if (hasDoc) {
            documentedParams++;
          } else {
            undocumented.push(`${file}: "${key}": ${obj[key]}`);
          }
        }
      }
    } catch { /* skip */ }
  }

  if (totalParams === 0) {
    return { pass: true, code: 'EC003', message: 'No numeric parameters found in config files', skipped: true };
  }

  const docRate = documentedParams / totalParams;
  if (docRate < 0.5 && totalParams > 2) {
    return {
      pass: false, code: 'EC003',
      message: `${documentedParams}/${totalParams} hyperparameters documented (${Math.round(docRate * 100)}%)`,
      detail: undocumented.slice(0, 5).join('\n') +
        '\n\nAdd inline comments to config.yaml:\n' +
        '  n_estimators: 200    # number of trees; more = lower variance, higher cost [50-500]\n' +
        '  learning_rate: 0.05  # step size; lower = more conservative [0.001-0.3]\n' +
        '  max_depth: 6         # tree depth; higher = more complex, overfit risk [3-10]',
    };
  }

  return {
    pass: true, code: 'EC003',
    message: `${documentedParams}/${totalParams} hyperparameters documented (${Math.round(docRate * 100)}%)`,
  };
}
