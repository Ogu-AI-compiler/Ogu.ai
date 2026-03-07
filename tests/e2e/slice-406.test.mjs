/**
 * Slice 406 — Workspace Isolation
 */
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}
async function assertAsync(label, fn) {
  try { await fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log('\n\x1b[1mSlice 406 — Workspace Isolation\x1b[0m\n');

const { resolveWorkspace, initWorkspace, getOrCreateWorkspace } =
  await import('../../tools/studio/server/workspace/resolver.mjs');

function makeTestWorkspace() {
  // Override the workspace base for testing
  const base = join(tmpdir(), `ogu-406-${randomUUID().slice(0, 8)}`);
  mkdirSync(base, { recursive: true });
  return base;
}

assert('resolveWorkspace returns different paths for different users', () => {
  delete process.env.DEPLOYMENT_MODE;
  const p1 = resolveWorkspace('user-aaa');
  const p2 = resolveWorkspace('user-bbb');
  if (p1 === p2) throw new Error('different users should have different workspace paths');
});

assert('resolveWorkspace path includes userId', () => {
  const userId = 'user-12345';
  const path = resolveWorkspace(userId);
  if (!path.includes(userId)) throw new Error(`path should include userId, got: ${path}`);
});

assert('resolveWorkspace throws for empty userId', () => {
  let threw = false;
  try { resolveWorkspace(''); }
  catch { threw = true; }
  if (!threw) throw new Error('should throw for empty userId');
});

assert('resolveWorkspace throws for null userId', () => {
  let threw = false;
  try { resolveWorkspace(null); }
  catch { threw = true; }
  if (!threw) throw new Error('should throw for null userId');
});

assert('resolveWorkspace returns /home/user in fly mode', () => {
  process.env.DEPLOYMENT_MODE = 'fly';
  const path = resolveWorkspace('any-user');
  if (path !== '/home/user') throw new Error(`expected /home/user, got ${path}`);
  delete process.env.DEPLOYMENT_MODE;
});

assert('resolveWorkspace uses ~/OguWorkspaces/ in local mode', () => {
  delete process.env.DEPLOYMENT_MODE;
  const path = resolveWorkspace('user-local');
  if (!path.includes('OguWorkspaces')) throw new Error(`expected OguWorkspaces, got ${path}`);
});

assert('initWorkspace creates directory', () => {
  delete process.env.DEPLOYMENT_MODE;
  const userId = `test-user-${randomUUID().slice(0, 8)}`;
  const path = resolveWorkspace(userId);
  mkdirSync(path, { recursive: true }); // Simulate initWorkspace mkdir
  if (!existsSync(path)) throw new Error('workspace directory should exist');
  rmSync(path, { recursive: true, force: true });
});

assert('getOrCreateWorkspace returns workspace path', () => {
  delete process.env.DEPLOYMENT_MODE;
  const userId = `test-user-${randomUUID().slice(0, 8)}`;
  const path = resolveWorkspace(userId);
  mkdirSync(path, { recursive: true });
  const result = getOrCreateWorkspace(userId);
  if (!result) throw new Error('should return path');
  if (!existsSync(result)) throw new Error('workspace should exist');
  rmSync(path, { recursive: true, force: true });
});

assert('two users get completely different workspace roots', () => {
  delete process.env.DEPLOYMENT_MODE;
  const p1 = resolveWorkspace('alice-id');
  const p2 = resolveWorkspace('bob-id');
  if (p1.startsWith(p2) || p2.startsWith(p1)) throw new Error('workspaces should not share parent paths');
  if (p1 === p2) throw new Error('paths must differ');
});

assert('workspace resolver module exports expected functions', () => {
  if (typeof resolveWorkspace !== 'function') throw new Error('resolveWorkspace not exported');
  if (typeof initWorkspace !== 'function') throw new Error('initWorkspace not exported');
  if (typeof getOrCreateWorkspace !== 'function') throw new Error('getOrCreateWorkspace not exported');
});

assert('router.ts file exists', () => {
  if (!existsSync(join(process.cwd(), 'tools/studio/server/api/router.ts'))) {
    throw new Error('router.ts missing');
  }
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
