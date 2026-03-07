/**
 * Slice 409 — Landing Page
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log('\n\x1b[1mSlice 409 — Landing Page\x1b[0m\n');

const cwd = process.cwd();
const landingDir = join(cwd, 'tools/studio/landing');

assert('landing/index.html exists', () => {
  if (!existsSync(join(landingDir, 'index.html'))) throw new Error('missing index.html');
});

assert('landing/pricing.html exists', () => {
  if (!existsSync(join(landingDir, 'pricing.html'))) throw new Error('missing pricing.html');
});

assert('landing/style.css exists', () => {
  if (!existsSync(join(landingDir, 'style.css'))) throw new Error('missing style.css');
});

assert('index.html has hero section with CTA', () => {
  const src = readFileSync(join(landingDir, 'index.html'), 'utf-8');
  if (!src.includes('hero') && !src.toLowerCase().includes('get started')) throw new Error('missing hero/CTA');
});

assert('index.html has 3 pricing plans', () => {
  const src = readFileSync(join(landingDir, 'index.html'), 'utf-8');
  const freeCount = (src.match(/[Ff]ree/g) || []).length;
  const proCount = (src.match(/[Pp]ro/g) || []).length;
  const entCount = (src.match(/[Ee]nterprise/g) || []).length;
  if (freeCount < 1) throw new Error('missing Free plan');
  if (proCount < 1) throw new Error('missing Pro plan');
  if (entCount < 1) throw new Error('missing Enterprise plan');
});

assert('index.html CTA points to /app', () => {
  const src = readFileSync(join(landingDir, 'index.html'), 'utf-8');
  if (!src.includes('href="/app"')) throw new Error('CTA should point to /app');
});

assert('pricing.html has all 3 plans', () => {
  const src = readFileSync(join(landingDir, 'pricing.html'), 'utf-8');
  if (!src.includes('$0') && !src.includes('Free')) throw new Error('missing Free plan');
  if (!src.includes('$49') && !src.includes('Pro')) throw new Error('missing Pro plan');
  if (!src.includes('$199') && !src.includes('Enterprise')) throw new Error('missing Enterprise plan');
});

assert('pricing.html has comparison table', () => {
  const src = readFileSync(join(landingDir, 'pricing.html'), 'utf-8');
  if (!src.includes('<table') && !src.includes('<tr')) throw new Error('missing comparison table');
});

assert('index.html has features section', () => {
  const src = readFileSync(join(landingDir, 'index.html'), 'utf-8');
  if (!src.includes('features') && !src.includes('Features')) throw new Error('missing features section');
});

assert('style.css matches dark theme variables', () => {
  const src = readFileSync(join(landingDir, 'style.css'), 'utf-8');
  if (!src.includes('--bg') || !src.includes('--accent')) throw new Error('missing theme CSS variables');
});

assert('index.html is valid HTML (has doctype)', () => {
  const src = readFileSync(join(landingDir, 'index.html'), 'utf-8');
  if (!src.includes('<!DOCTYPE html>')) throw new Error('missing DOCTYPE');
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
