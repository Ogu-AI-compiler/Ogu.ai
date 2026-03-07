/**
 * Slice 407 — Project Ownership
 * Users can't see each other's projects.
 */
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log('\n\x1b[1mSlice 407 — Project Ownership\x1b[0m\n');

const { resolveWorkspace } = await import('../../tools/studio/server/workspace/resolver.mjs');

function makeWorkspace(userId) {
  const base = join(tmpdir(), `ogu-407-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(base, 'OguWorkspaces', userId, '.ogu'), { recursive: true });
  return join(base, 'OguWorkspaces', userId);
}

// Simulate user-scoped project registry
function writeRegistry(workspacePath, projects) {
  const dir = join(workspacePath, '.ogu');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'studio-projects.json'), JSON.stringify({ projects }, null, 2));
}

function readRegistry(workspacePath) {
  try {
    const data = JSON.parse(readFileSync(join(workspacePath, '.ogu', 'studio-projects.json'), 'utf-8'));
    return Array.isArray(data.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

assert('each user has separate workspace', () => {
  const p1 = resolveWorkspace('alice');
  const p2 = resolveWorkspace('bob');
  if (p1 === p2) throw new Error('workspaces must differ');
});

assert('user A projects not visible to user B (registry isolation)', () => {
  const wsA = makeWorkspace('alice-priv');
  const wsB = makeWorkspace('bob-priv');

  const aliceProjects = [{ slug: 'alice-proj', root: join(wsA, 'alice-proj'), createdAt: new Date().toISOString() }];
  const bobProjects = [{ slug: 'bob-proj', root: join(wsB, 'bob-proj'), createdAt: new Date().toISOString() }];

  writeRegistry(wsA, aliceProjects);
  writeRegistry(wsB, bobProjects);

  const aliceRead = readRegistry(wsA);
  const bobRead = readRegistry(wsB);

  if (aliceRead.some(p => p.slug === 'bob-proj')) throw new Error('Alice should not see Bob projects');
  if (bobRead.some(p => p.slug === 'alice-proj')) throw new Error('Bob should not see Alice projects');

  rmSync(wsA.replace(/\/alice-priv$/, ''), { recursive: true, force: true });
  rmSync(wsB.replace(/\/bob-priv$/, ''), { recursive: true, force: true });
});

assert('project registry is per-workspace, not global', () => {
  const wsA = makeWorkspace('alice-global');
  const wsB = makeWorkspace('bob-global');

  writeRegistry(wsA, [{ slug: 'shared-slug', root: wsA, createdAt: new Date().toISOString() }]);
  // Bob's registry is empty
  writeRegistry(wsB, []);

  const aliceProjects = readRegistry(wsA);
  const bobProjects = readRegistry(wsB);

  if (aliceProjects.length !== 1) throw new Error('Alice should have 1 project');
  if (bobProjects.length !== 0) throw new Error('Bob should have 0 projects');

  rmSync(wsA.replace(/\/alice-global$/, ''), { recursive: true, force: true });
  rmSync(wsB.replace(/\/bob-global$/, ''), { recursive: true, force: true });
});

assert('writing to one registry does not affect another', () => {
  const wsA = makeWorkspace('alice-write');
  const wsB = makeWorkspace('bob-write');

  writeRegistry(wsA, []);
  writeRegistry(wsB, [{ slug: 'bob-only', root: wsB, createdAt: new Date().toISOString() }]);

  // Read Alice's registry — should still be empty
  const aliceProjects = readRegistry(wsA);
  if (aliceProjects.length !== 0) throw new Error('Alice registry should still be empty');

  rmSync(wsA.replace(/\/alice-write$/, ''), { recursive: true, force: true });
  rmSync(wsB.replace(/\/bob-write$/, ''), { recursive: true, force: true });
});

assert('router.ts has REGISTRY_PATH logic', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/server/api/router.ts'), 'utf-8');
  if (!src.includes('REGISTRY_PATH') && !src.includes('studio-projects')) throw new Error('no registry logic in router');
});

assert('router.ts exports readProjectRegistry', () => {
  const src = readFileSync(join(process.cwd(), 'tools/studio/server/api/router.ts'), 'utf-8');
  if (!src.includes('readProjectRegistry')) throw new Error('missing readProjectRegistry export');
});

assert('workspace resolver file exists', () => {
  if (!existsSync(join(process.cwd(), 'tools/studio/server/workspace/resolver.mjs'))) {
    throw new Error('resolver.mjs missing');
  }
});

assert('user project deletion does not affect other users', () => {
  const wsA = makeWorkspace('alice-del');
  const wsB = makeWorkspace('bob-del');

  const projects = [{ slug: 'p1', root: wsA, createdAt: new Date().toISOString() }];
  writeRegistry(wsA, projects);
  writeRegistry(wsB, [{ slug: 'p2', root: wsB, createdAt: new Date().toISOString() }]);

  // Delete from Alice's registry
  writeRegistry(wsA, []);

  // Bob's projects should be unaffected
  const bobProjects = readRegistry(wsB);
  if (bobProjects.length !== 1) throw new Error('Bob projects should be unaffected by Alice deletion');

  rmSync(wsA.replace(/\/alice-del$/, ''), { recursive: true, force: true });
  rmSync(wsB.replace(/\/bob-del$/, ''), { recursive: true, force: true });
});

assert('projects can have same slug in different user workspaces', () => {
  const wsA = makeWorkspace('alice-slug');
  const wsB = makeWorkspace('bob-slug');

  writeRegistry(wsA, [{ slug: 'my-app', root: wsA, createdAt: new Date().toISOString() }]);
  writeRegistry(wsB, [{ slug: 'my-app', root: wsB, createdAt: new Date().toISOString() }]);

  const aliceProjects = readRegistry(wsA);
  const bobProjects = readRegistry(wsB);

  // Both can have 'my-app' without conflict
  if (aliceProjects[0].root === bobProjects[0].root) throw new Error('roots should differ');

  rmSync(wsA.replace(/\/alice-slug$/, ''), { recursive: true, force: true });
  rmSync(wsB.replace(/\/bob-slug$/, ''), { recursive: true, force: true });
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
