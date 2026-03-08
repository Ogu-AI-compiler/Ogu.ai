import { readFileSync, readdirSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
  if (!files.length) return { pass: false, code: 'EV005', message: 'No source file found' };
  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  // Count trackExposure / logExposure / expose calls
  const exposureCalls = (content.match(/trackExposure\s*\(|logExposure\s*\(|expose\s*\(|recordExposure\s*\(/g) || []).length;
  if (exposureCalls === 0) return { pass: false, code: 'EV005', message: 'No exposure tracking call found', detail: 'Call trackExposure(experimentId) once when variant is first rendered' };
  if (exposureCalls > 1) return { pass: false, code: 'EV005', message: `Multiple exposure tracking calls (${exposureCalls}) — must fire exactly once`, detail: 'Use useEffect with [] dependency to fire exactly once on mount' };
  // Must be in useEffect or mounted lifecycle
  const inEffect = /useEffect\s*\([^)]*trackExposure|useEffect\s*\([^)]*logExposure/.test(content);
  if (!inEffect) return { pass: false, code: 'EV005', message: 'Exposure tracking not inside useEffect — may fire on every render', detail: 'Wrap trackExposure in useEffect(() => { ... }, [])' };
  return { pass: true, code: 'EV005', message: 'Single exposure tracking in useEffect' };
}
