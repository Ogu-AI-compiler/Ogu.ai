import { readFileSync, existsSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'feature-module-spec.json');
  if (!existsSync(specPath)) return { pass: true, code: 'FM003', message: 'No spec — capability check skipped', skipped: true };
  let spec; try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return { pass: true, code: 'FM003', message: 'Cannot read spec', skipped: true }; }
  if (!Array.isArray(spec.capabilities)) return { pass: true, code: 'FM003', message: 'No capabilities array', skipped: true };
  const files = readdirSync(dir).map(f => f.replace(/\.(tsx?|jsx?)$/, '').toLowerCase());
  const missing = spec.capabilities.filter(cap => !files.includes(cap.toLowerCase().replace(/[-\s]/g, '')));
  if (missing.length) return { pass: false, code: 'FM003', message: `Missing capability files: ${missing.join(', ')}`, detail: `Each capability must have a corresponding file in the feature directory` };
  return { pass: true, code: 'FM003', message: `All ${spec.capabilities.length} capability files present` };
}
