import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * AB002 — treatment-control-defined
 * A/B test specs must explicitly define treatment and control groups.
 *
 * Why:
 * - Without explicitly declared treatment/control groups, there is no
 *   clear definition of what is being compared. Analysis code may use
 *   different group labels than the spec intended, silently producing
 *   inverted or wrong results (treatment vs control swapped).
 * - The control group must be the status quo (current system behavior).
 *   The treatment is the change being tested. This distinction matters
 *   for one-tailed hypothesis testing and result interpretation.
 * - Declaring groups in the spec creates a machine-verifiable contract
 *   that analysis code can be validated against.
 *
 * Escape hatch: add "groupsInCode": true to ab-test-spec.json if group
 * definitions are necessarily in the analysis code (e.g., multi-armed bandits).
 */


export async function run({ dir }) {
  const specPath = join(dir, 'ab-test-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'AB002', message: 'ab-test-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return { pass: false, code: 'AB002', message: 'Invalid JSON' }; }

  // Must have a control group
  const hasControl = spec.control_variant ||
    (Array.isArray(spec.treatment_variants) && spec.treatment_variants.some(v =>
      (typeof v === 'string' && /control|baseline/i.test(v)) ||
      (typeof v === 'object' && (v.is_control || /control|baseline/i.test(v.name || '')))
    ));

  if (!hasControl) {
    return {
      pass: false, code: 'AB002',
      message: 'No control variant defined — A/B test requires a control group',
      detail: 'Add "control_variant": "control" to spec or mark one variant with "is_control": true'
    };
  }

  // Check Python/notebook code for control/treatment split
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  if (!pyFiles.length) return { pass: true, code: 'AB002', message: 'Control variant defined in spec', skipped: true };

  let content = '';
  for (const f of pyFiles) {
    const raw = readFileSync(join(dir, f), 'utf8');
    if (f.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(raw);
        content += (nb.cells || []).map(c => Array.isArray(c.source) ? c.source.join('') : (c.source || '')).join('\n');
      } catch {}
    } else {
      content += raw;
    }
  }

  const hasTreatmentSplit = /control|treatment|variant|group.*==|==.*group|\['variant'\]|\['group'\]/.test(content);
  if (!hasTreatmentSplit) {
    return {
      pass: false, code: 'AB002',
      message: 'No treatment/control group splitting detected in code',
      detail: 'Split data into control and treatment groups before analysis'
    };
  }

  return { pass: true, code: 'AB002', message: 'Control and treatment groups properly defined' };
}
