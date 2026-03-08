import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** DV005 — all-ecosystems-covered: every declared ecosystem must have a policy entry */
export async function run({ dir }) {
  const specPath = join(dir, 'dep-vuln-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'DV005', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'DV005', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.ecosystems) || spec.ecosystems.length === 0) return { pass: true, code: 'DV005', message: 'No ecosystems — gate skipped', skipped: true };

  const violations = [];
  for (const ecosystem of spec.ecosystems) {
    const name = typeof ecosystem === 'string' ? ecosystem : (ecosystem.name || ecosystem.type || '?');
    const eco = typeof ecosystem === 'object' ? ecosystem : {};
    if (typeof ecosystem === 'object' && !eco.scanner && !eco.tool && !eco.audit_command) {
      violations.push(`Ecosystem "${name}": must declare a scanner, tool, or audit_command (e.g. scanner: "npm-audit", tool: "snyk")`);
    }
  }

  if (violations.length > 0) return { pass: false, code: 'DV005', message: `${violations.length} ecosystem(s) missing scanner configuration`, detail: violations.join('\n') };
  return { pass: true, code: 'DV005', message: `All ${spec.ecosystems.length} ecosystem(s) have scanner configuration` };
}
