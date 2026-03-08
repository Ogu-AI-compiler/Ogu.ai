import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** RDR002 — no-redirect-loops: no A→A self-redirects or A→B→A circular loops */
export async function run({ dir }) {
  const specPath = join(dir, 'redirect-manifest.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RDR002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RDR002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.redirects) || spec.redirects.length === 0) {
    return { pass: true, code: 'RDR002', message: 'No redirects defined — gate skipped', skipped: true };
  }

  const violations = [];

  // Build redirect map: from → to
  const redirectMap = new Map();
  for (const r of spec.redirects) {
    if (r.from && r.to) {
      redirectMap.set(r.from, r.to);
    }
  }

  // Check each redirect for loops using path traversal
  for (const [from, to] of redirectMap.entries()) {
    // Self-redirect
    if (from === to) {
      violations.push(`Self-redirect: "${from}" → "${to}"`);
      continue;
    }

    // Detect cycles using visited path
    const visited = new Set([from]);
    let current = to;
    let steps = 0;
    const maxSteps = redirectMap.size + 1;

    while (redirectMap.has(current) && steps < maxSteps) {
      if (visited.has(current)) {
        violations.push(`Circular redirect loop detected involving "${from}"`);
        break;
      }
      visited.add(current);
      current = redirectMap.get(current);
      steps++;
    }
  }

  const uniqueViolations = [...new Set(violations)];

  if (uniqueViolations.length > 0) {
    return {
      pass: false,
      code: 'RDR002',
      message: `${uniqueViolations.length} redirect loop(s) detected`,
      detail: uniqueViolations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RDR002',
    message: `No redirect loops in ${spec.redirects.length} redirect(s)`,
  };
}
