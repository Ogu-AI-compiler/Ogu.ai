/**
 * Gate: outputs-declared (IAC003)
 * For Terraform stacks: verifies that every output listed in iac-spec.json has a
 * corresponding output block in the .tf files. Missing outputs break downstream
 * consumers (other modules, pipelines, deployment scripts) that reference them.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

function findTfFiles(dir) {
  try {
    return readdirSync(dir).filter(f => f.endsWith('.tf')).map(f => join(dir, f));
  } catch { return []; }
}

export async function run({ dir }) {
  const spec            = JSON.parse(readFileSync(join(dir, 'iac-spec.json'), 'utf8'));
  const requiredOutputs = spec.outputs || [];

  if (requiredOutputs.length === 0) {
    return { pass: true, code: 'IAC003', message: 'No outputs declared in spec — skipped', skipped: true };
  }

  if (spec.platform === 'terraform') {
    const tfFiles = findTfFiles(dir);
    if (tfFiles.length === 0) {
      return { pass: true, code: 'IAC003', message: 'No .tf files — output check skipped', skipped: true };
    }

    const allContent = tfFiles.map(f => readFileSync(f, 'utf8')).join('\n');
    const violations = [];

    for (const output of requiredOutputs) {
      const name = typeof output === 'string' ? output : output.name;
      if (!new RegExp(`output\\s+"${name}"`, 'm').test(allContent)) {
        violations.push({ name, reason: 'output block not found in any .tf file' });
      }
    }

    if (violations.length) {
      return {
        pass: false, code: 'IAC003',
        message: `${violations.length} missing output(s)`,
        detail: {
          violations,
          hint: 'Add an output block to outputs.tf for each missing output. Downstream consumers depend on these values.',
        },
      };
    }

    return { pass: true, code: 'IAC003', message: `All ${requiredOutputs.length} required outputs declared in .tf files` };
  }

  return { pass: true, code: 'IAC003', message: `${requiredOutputs.length} outputs declared in spec` };
}
