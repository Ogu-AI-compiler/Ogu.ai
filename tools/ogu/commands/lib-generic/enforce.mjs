import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, readJsonSafe } from '../../util.mjs';

/**
 * Enforce — validate code matches vault contracts via IR.
 *
 * Checks that IR outputs exist in the codebase and
 * contract invariants are satisfied.
 */

/**
 * Enforce contracts for a feature.
 */
export function enforceContracts({ root, featureSlug } = {}) {
  root = root || repoRoot();
  const contractsDir = join(root, 'docs/vault/02_Contracts');
  const checks = [];
  let violations = 0;

  if (!existsSync(contractsDir)) {
    return { violations: 0, checks: [] };
  }

  const contractFiles = readdirSync(contractsDir).filter(f => f.endsWith('.contract.json'));

  for (const file of contractFiles) {
    const contract = readJsonSafe(join(contractsDir, file));
    if (!contract) continue;

    // Check outputs declared in contract exist
    for (const output of (contract.outputs || [])) {
      const found = checkOutputExists(root, output);
      checks.push({
        contract: contract.name || file,
        check: `output:${output}`,
        status: found ? 'pass' : 'fail',
      });
      if (!found) violations++;
    }
  }

  return { violations, checks };
}

/**
 * Enforce IR outputs exist in code.
 */
export function enforceIR({ root, featureSlug } = {}) {
  root = root || repoRoot();
  const featureDir = join(root, `docs/vault/04_Features/${featureSlug}`);
  const plan = readJsonSafe(join(featureDir, 'Plan.json'));

  if (!plan?.tasks) return { present: 0, missing: 0, details: [] };

  let present = 0;
  let missing = 0;
  const details = [];

  for (const task of plan.tasks) {
    for (const output of (task.outputs || [])) {
      const found = checkOutputExists(root, output);
      if (found) {
        present++;
        details.push({ output, status: 'present' });
      } else {
        missing++;
        details.push({ output, status: 'missing' });
      }
    }
  }

  return { present, missing, details };
}

/**
 * Get combined enforcement summary.
 */
export function enforceSummary({ root, featureSlug } = {}) {
  root = root || repoRoot();
  const contracts = enforceContracts({ root, featureSlug });
  const ir = enforceIR({ root, featureSlug });

  return {
    contractViolations: contracts.violations,
    irPresent: ir.present,
    irMissing: ir.missing,
    ok: contracts.violations === 0 && ir.missing === 0,
  };
}

function checkOutputExists(root, output) {
  if (output.startsWith('COMPONENT:')) {
    const name = output.replace('COMPONENT:', '');
    return searchForSymbol(root, name);
  }
  if (output.startsWith('ROUTE:')) {
    const route = output.replace('ROUTE:', '');
    return searchForString(root, route);
  }
  if (output.startsWith('API:')) {
    const endpoint = output.replace('API:', '');
    return searchForString(root, endpoint);
  }
  if (output.startsWith('CONTRACT:')) {
    const name = output.replace('CONTRACT:', '');
    return existsSync(join(root, `docs/vault/02_Contracts/${name}.contract.json`)) ||
           existsSync(join(root, `docs/vault/02_Contracts/${name}.contract.md`));
  }
  // Default: search for the string
  return searchForString(root, output);
}

function searchForSymbol(root, name) {
  const dirs = ['src', 'lib', 'apps', 'packages'];
  for (const dir of dirs) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    if (searchDir(fullDir, (content) =>
      content.includes(`function ${name}`) ||
      content.includes(`const ${name}`) ||
      content.includes(`class ${name}`)
    )) return true;
  }
  return false;
}

function searchForString(root, str) {
  const dirs = ['src', 'lib', 'apps', 'packages'];
  for (const dir of dirs) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    if (searchDir(fullDir, (content) => content.includes(str))) return true;
  }
  return false;
}

function searchDir(dir, predicate) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (searchDir(fullPath, predicate)) return true;
      } else if (/\.(tsx?|jsx?|mjs)$/.test(entry.name)) {
        const content = readFileSync(fullPath, 'utf8');
        if (predicate(content)) return true;
      }
    }
  } catch { /* skip */ }
  return false;
}
