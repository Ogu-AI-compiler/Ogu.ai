import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/** QA018 — contract-coverage: validates the compiled coverage-policy-artifact.json */

export async function run({ dir }) {
  const ap = join(dir, 'coverage-policy-artifact.json');
  if (!existsSync(ap)) return { pass: false, code: 'QA018', message: 'coverage-policy-artifact.json not found' };
  let a; try { a = JSON.parse(readFileSync(ap, 'utf8')); } catch (e) { return { pass: false, code: 'QA018', message: `Invalid JSON: ${e.message}` }; }
  const required = ['ir_id', 'global', 'failBuildBelow', 'attestation'];
  const missing = required.filter(k => !(k in a));
  if (missing.length) return { pass: false, code: 'QA018', message: `Missing fields: ${missing.join(', ')}` };
  if (!a.ir_id.startsWith('COVERAGE_POLICY:')) return { pass: false, code: 'QA018', message: 'ir_id must start with COVERAGE_POLICY:' };
  if (!a.attestation?.hash) return { pass: false, code: 'QA018', message: 'attestation.hash missing' };
  return { pass: true, code: 'QA018', message: `Coverage policy artifact valid — lines:${a.global?.lines}% branches:${a.global?.branches}%` };
}
