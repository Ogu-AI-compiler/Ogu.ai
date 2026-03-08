/**
 * Gate: inputs-declared (IAC002)
 * For Terraform stacks: verifies that every input declared in iac-spec.json has a
 * corresponding variable block in the .tf files, with a type annotation. Undeclared
 * or untyped variables cause `terraform plan` failures at the worst possible moment.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

function findTfFiles(dir) {
  try {
    return readdirSync(dir).filter(f => f.endsWith('.tf')).map(f => join(dir, f));
  } catch { return []; }
}

export async function run({ dir }) {
  const spec           = JSON.parse(readFileSync(join(dir, 'iac-spec.json'), 'utf8'));
  const declaredInputs = spec.inputs || [];

  if (declaredInputs.length === 0) {
    return { pass: true, code: 'IAC002', message: 'No inputs declared in spec — skipped', skipped: true };
  }

  if (spec.platform === 'terraform') {
    const tfFiles = findTfFiles(dir);
    if (tfFiles.length === 0) {
      return {
        pass: false, code: 'IAC002',
        message: 'No .tf files found — cannot validate input declarations',
        detail: { hint: 'Create variables.tf with variable blocks for all declared inputs' },
      };
    }

    const allContent = tfFiles.map(f => readFileSync(f, 'utf8')).join('\n');
    const violations = [];

    for (const input of declaredInputs) {
      const name = typeof input === 'string' ? input : input.name;
      const type = typeof input === 'object' ? input.type : null;

      if (!new RegExp(`variable\\s+"${name}"`, 'm').test(allContent)) {
        violations.push({ name, reason: 'variable block not found in any .tf file' });
        continue;
      }

      if (type && !new RegExp(`variable\\s+"${name}"[\\s\\S]*?type\\s*=`, 'm').test(allContent)) {
        violations.push({ name, reason: 'variable declared but has no type annotation' });
      }
    }

    if (violations.length) {
      return {
        pass: false, code: 'IAC002',
        message: `${violations.length} undeclared/untyped input(s)`,
        detail: {
          violations,
          hint: 'Add a variable block with a type annotation to variables.tf for each missing input',
        },
      };
    }

    return { pass: true, code: 'IAC002', message: `All ${declaredInputs.length} inputs declared and typed in .tf files` };
  }

  // Pulumi/CDK: validate from spec structure only
  const violations = (spec.inputs || [])
    .filter(i => typeof i === 'object' && !i.type)
    .map(i => ({ name: i.name, reason: 'missing type declaration in spec' }));

  if (violations.length) {
    return {
      pass: false, code: 'IAC002',
      message: `${violations.length} untyped input(s)`,
      detail: { violations, hint: 'Add a type field to each input entry in iac-spec.json' },
    };
  }

  return { pass: true, code: 'IAC002', message: `All ${declaredInputs.length} inputs declared in spec` };
}
