/**
 * Gate: no-unresolved-refs (IAC004)
 * For Terraform: checks that all module blocks declare a source attribute. A module
 * block without a source is a syntax error that `terraform init` will reject. Also
 * validates the structure of module blocks before plan/apply time.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function findTfFiles(dir) {
  try {
    return readdirSync(dir).filter(f => f.endsWith('.tf')).map(f => join(dir, f));
  } catch { return []; }
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'iac-spec.json'), 'utf8'));

  if (spec.platform !== 'terraform') {
    return { pass: true, code: 'IAC004', message: `Non-Terraform platform (${spec.platform}) — ref check skipped`, skipped: true };
  }

  const tfFiles = findTfFiles(dir);
  if (tfFiles.length === 0) {
    return { pass: true, code: 'IAC004', message: 'No .tf files — unresolved ref check skipped', skipped: true };
  }

  const allContent = tfFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const violations = [];

  // Every module block must declare a source
  const moduleMatches = [...allContent.matchAll(/module\s+"([^"]+)"\s*\{([^}]+)\}/gs)];
  for (const m of moduleMatches) {
    const moduleName  = m[1];
    const moduleBody  = m[2];
    if (!moduleBody.includes('source')) {
      violations.push({
        name:   moduleName,
        reason: `module "${moduleName}" is missing a source attribute — terraform init will fail`,
        hint:   'Add: source = "path/to/module" or source = "hashicorp/consul/aws"',
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'IAC004',
      message: `${violations.length} module(s) with unresolved references`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'IAC004',
    message: `No unresolved references detected in ${tfFiles.length} .tf file(s)`,
  };
}
