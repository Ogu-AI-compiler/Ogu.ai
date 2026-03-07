/**
 * Slice 403 — Credits System
 */
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log('\n\x1b[1mSlice 403 — Credits System\x1b[0m\n');

const { getBalance, deductCredits, addCredits, getTransactions } =
  await import('../../tools/studio/server/billing/credits.mjs');
const { createUser } = await import('../../tools/studio/server/auth/user-store.mjs');

function makeDataDir() {
  const dir = join(tmpdir(), `ogu-403-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

assert('new user has 100 credits', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'c1@test.com', password: 'pw', name: 'C1' });
  const balance = getBalance(user.id);
  if (balance !== 100) throw new Error(`expected 100, got ${balance}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('deductCredits reduces balance', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'c2@test.com', password: 'pw', name: 'C2' });
  deductCredits(user.id, 30, 'test');
  if (getBalance(user.id) !== 70) throw new Error(`expected 70, got ${getBalance(user.id)}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('deductCredits returns { success: true, remaining }', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'c3@test.com', password: 'pw', name: 'C3' });
  const result = deductCredits(user.id, 10, 'llm');
  if (!result.success) throw new Error('should succeed');
  if (result.remaining !== 90) throw new Error(`expected 90, got ${result.remaining}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('deductCredits returns { success: false } when insufficient', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'c4@test.com', password: 'pw', name: 'C4' });
  const result = deductCredits(user.id, 200, 'too much');
  if (result.success) throw new Error('should fail - not enough credits');
  if (result.remaining !== 100) throw new Error('remaining should still be 100');
  rmSync(dir, { recursive: true, force: true });
});

assert('addCredits increases balance', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'c5@test.com', password: 'pw', name: 'C5' });
  const newBalance = addCredits(user.id, 50, 'top-up');
  if (newBalance !== 150) throw new Error(`expected 150, got ${newBalance}`);
  if (getBalance(user.id) !== 150) throw new Error('getBalance should also be 150');
  rmSync(dir, { recursive: true, force: true });
});

assert('addCredits works for user with no entry', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const newBalance = addCredits('new-user-id', 50, 'initial');
  if (newBalance !== 50) throw new Error(`expected 50, got ${newBalance}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('deductCredits throws for zero amount', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  let threw = false;
  try { deductCredits('u', 0, 'bad'); }
  catch { threw = true; }
  if (!threw) throw new Error('should throw for 0 amount');
  rmSync(dir, { recursive: true, force: true });
});

assert('addCredits throws for negative amount', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  let threw = false;
  try { addCredits('u', -10, 'bad'); }
  catch { threw = true; }
  if (!threw) throw new Error('should throw for negative amount');
  rmSync(dir, { recursive: true, force: true });
});

assert('getBalance returns 0 for unknown user', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const balance = getBalance('unknown-user-xyz');
  if (balance !== 0) throw new Error(`expected 0, got ${balance}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('multiple deductions accumulate correctly', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'c6@test.com', password: 'pw', name: 'C6' });
  deductCredits(user.id, 10, 'a');
  deductCredits(user.id, 20, 'b');
  deductCredits(user.id, 5, 'c');
  if (getBalance(user.id) !== 65) throw new Error(`expected 65, got ${getBalance(user.id)}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('getTransactions returns transaction history', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'c7@test.com', password: 'pw', name: 'C7' });
  deductCredits(user.id, 10, 'llm-spend');
  addCredits(user.id, 5, 'refund');
  const txs = getTransactions(user.id);
  if (!Array.isArray(txs)) throw new Error('should be array');
  if (txs.length < 2) throw new Error(`expected at least 2 txs, got ${txs.length}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('budget-tracker.mjs exports expected functions', () => {
  const src = readFileSync('tools/ogu/commands/lib/budget-tracker.mjs', 'utf-8');
  if (!src.includes('export')) throw new Error('should export functions');
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
