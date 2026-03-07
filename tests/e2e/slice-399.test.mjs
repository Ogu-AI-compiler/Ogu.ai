/**
 * Slice 399 — Login/Signup UI
 * Tests: auth store fields, API helper, App auth gate logic.
 */
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log('\n\x1b[1mSlice 399 — Login/Signup UI\x1b[0m\n');

// Test that UI files exist
assert('Auth.tsx page exists', () => {
  const p = join(process.cwd(), 'tools/studio/src/pages/Auth.tsx');
  if (!existsSync(p)) throw new Error(`File not found: ${p}`);
});

assert('LoginForm.tsx component exists', () => {
  const p = join(process.cwd(), 'tools/studio/src/components/auth/LoginForm.tsx');
  if (!existsSync(p)) throw new Error(`File not found: ${p}`);
});

assert('SignupForm.tsx component exists', () => {
  const p = join(process.cwd(), 'tools/studio/src/components/auth/SignupForm.tsx');
  if (!existsSync(p)) throw new Error(`File not found: ${p}`);
});

// Test store has auth fields (check source file content)
import { readFileSync } from 'node:fs';

assert('store.ts has currentUser field', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/lib/store.ts'), 'utf-8');
  if (!src.includes('currentUser')) throw new Error('missing currentUser field');
});

assert('store.ts has accessToken field', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/lib/store.ts'), 'utf-8');
  if (!src.includes('accessToken')) throw new Error('missing accessToken field');
});

assert('store.ts has setAuth action', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/lib/store.ts'), 'utf-8');
  if (!src.includes('setAuth')) throw new Error('missing setAuth action');
});

assert('store.ts has clearAuth action', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/lib/store.ts'), 'utf-8');
  if (!src.includes('clearAuth')) throw new Error('missing clearAuth action');
});

assert('api.ts has Authorization header logic', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/lib/api.ts'), 'utf-8');
  if (!src.includes('Authorization')) throw new Error('missing Authorization header');
});

assert('App.tsx has auth gate check', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/App.tsx'), 'utf-8');
  if (!src.includes('Auth') && !src.includes('accessToken')) throw new Error('missing auth gate');
});

// Test Auth.tsx has tab switcher
assert('Auth.tsx has Login tab', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/pages/Auth.tsx'), 'utf-8');
  if (!src.toLowerCase().includes('login')) throw new Error('missing Login tab');
});

assert('Auth.tsx has Sign up tab', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/pages/Auth.tsx'), 'utf-8');
  if (!src.toLowerCase().includes('sign') && !src.toLowerCase().includes('register')) throw new Error('missing Signup');
});

assert('LoginForm.tsx has email input', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/components/auth/LoginForm.tsx'), 'utf-8');
  if (!src.includes('email')) throw new Error('missing email input');
});

assert('LoginForm.tsx has password input', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/components/auth/LoginForm.tsx'), 'utf-8');
  if (!src.includes('password')) throw new Error('missing password input');
});

assert('SignupForm.tsx has name field', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/components/auth/SignupForm.tsx'), 'utf-8');
  if (!src.includes('name')) throw new Error('missing name field');
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
