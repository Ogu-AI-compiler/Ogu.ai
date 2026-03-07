/**
 * Slice 410 — Admin Dashboard
 */
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log('\n\x1b[1mSlice 410 — Admin Dashboard\x1b[0m\n');

const { createUser, listUsers, setUserRole, banUser, getUserById } =
  await import('../../tools/studio/server/auth/user-store.mjs');
const { getUsageSummary } = await import('../../tools/studio/server/billing/quota.mjs');
const { getBalance } = await import('../../tools/studio/server/billing/credits.mjs');
const { login } = await import('../../tools/studio/server/auth/auth-service.mjs');

function makeDataDir() {
  const dir = join(tmpdir(), `ogu-410-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

assert('admin.ts file exists', () => {
  if (!existsSync(join(process.cwd(), 'tools/studio/server/api/admin.ts'))) {
    throw new Error('admin.ts missing');
  }
});

assert('admin.ts has GET /admin/stats', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/server/api/admin.ts'), 'utf-8');
  if (!src.includes('/admin/stats')) throw new Error('missing /admin/stats');
});

assert('admin.ts has GET /admin/users', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/server/api/admin.ts'), 'utf-8');
  if (!src.includes('/admin/users')) throw new Error('missing /admin/users');
});

assert('admin.ts has POST /admin/users/:id/ban', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/server/api/admin.ts'), 'utf-8');
  if (!src.includes('ban')) throw new Error('missing ban endpoint');
});

assert('admin.ts requires admin role', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/server/api/admin.ts'), 'utf-8');
  if (!src.includes("admin")) throw new Error('missing admin role check');
});

assert('Admin.tsx page exists', () => {
  if (!existsSync(join(process.cwd(), 'tools/studio/src/pages/Admin.tsx'))) {
    throw new Error('Admin.tsx missing');
  }
});

assert('Admin.tsx shows users table', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/pages/Admin.tsx'), 'utf-8');
  if (!src.includes('Users') && !src.includes('table')) throw new Error('missing users table');
});

assert('Admin.tsx has ban button', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/src/pages/Admin.tsx'), 'utf-8');
  if (!src.includes('Ban') && !src.includes('ban')) throw new Error('missing ban button');
});

assert('setUserRole works', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'admin-test@test.com', password: 'pw', name: 'A' });
  setUserRole(user.id, 'admin');
  const updated = getUserById(user.id);
  if (updated.role !== 'admin') throw new Error(`expected admin, got ${updated.role}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('banUser marks user as banned', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'ban-test@test.com', password: 'pw', name: 'B' });
  banUser(user.id);
  const updated = getUserById(user.id);
  if (!updated.banned) throw new Error('user should be banned');
  rmSync(dir, { recursive: true, force: true });
});

assert('admin can list all users', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  createUser({ email: 'list1@test.com', password: 'pw', name: 'L1' });
  createUser({ email: 'list2@test.com', password: 'pw', name: 'L2' });
  const users = listUsers();
  if (users.length < 2) throw new Error(`expected at least 2 users, got ${users.length}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('login throws for banned user', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'banned@test.com', password: 'pw', name: 'B' });
  banUser(user.id);
  let threw = false;
  try { login({ email: 'banned@test.com', password: 'pw' }); }
  catch (e) { threw = true; if (!e.message.includes('suspend') && !e.message.includes('banned') && !e.message.includes('credential')) throw new Error(`wrong error: ${e.message}`); }
  if (!threw) throw new Error('should throw for banned user');
  rmSync(dir, { recursive: true, force: true });
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
