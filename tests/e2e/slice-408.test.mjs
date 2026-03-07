/**
 * Slice 408 — Org & Team Management
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log('\n\x1b[1mSlice 408 — Org & Team Management\x1b[0m\n');

const { inviteMember, acceptInvite, removeMember, updateRole, listMembers, getPendingInvites } =
  await import('../../tools/studio/server/auth/org-store.mjs');
const { createUser } = await import('../../tools/studio/server/auth/user-store.mjs');

function makeDataDir() {
  const dir = join(tmpdir(), `ogu-408-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

assert('inviteMember creates invite token', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const token = inviteMember('org-1', 'newmember@test.com', 'member');
  if (!token || typeof token !== 'string') throw new Error('should return token');
  if (token.length < 10) throw new Error('token too short');
  rmSync(dir, { recursive: true, force: true });
});

assert('inviteMember same email returns same token (idempotent)', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const t1 = inviteMember('org-1', 'member@test.com', 'member');
  const t2 = inviteMember('org-1', 'member@test.com', 'member');
  if (t1 !== t2) throw new Error('should return same token for duplicate invite');
  rmSync(dir, { recursive: true, force: true });
});

assert('getPendingInvites shows pending invites', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  inviteMember('org-2', 'pending@test.com', 'member');
  const pending = getPendingInvites('org-2');
  if (pending.length !== 1) throw new Error(`expected 1 pending, got ${pending.length}`);
  if (pending[0].email !== 'pending@test.com') throw new Error('wrong email in pending');
  rmSync(dir, { recursive: true, force: true });
});

assert('acceptInvite adds user to org', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'joiner@test.com', password: 'pw', name: 'Joiner' });
  const token = inviteMember('org-target', 'joiner@test.com', 'member');
  const result = acceptInvite(token, user.id);
  if (!result.orgId) throw new Error('should return orgId');
  if (result.role !== 'member') throw new Error('wrong role');
  rmSync(dir, { recursive: true, force: true });
});

assert('acceptInvite marks invite as accepted', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'accepter@test.com', password: 'pw', name: 'Accepter' });
  const token = inviteMember('org-3', 'accepter@test.com', 'member');
  acceptInvite(token, user.id);
  const pending = getPendingInvites('org-3');
  if (pending.length !== 0) throw new Error('invite should be removed from pending after accept');
  rmSync(dir, { recursive: true, force: true });
});

assert('acceptInvite throws for invalid token', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  let threw = false;
  try { acceptInvite('invalid-token-xyz', 'some-user-id'); }
  catch { threw = true; }
  if (!threw) throw new Error('should throw for invalid token');
  rmSync(dir, { recursive: true, force: true });
});

assert('acceptInvite throws for already-used token', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const user = createUser({ email: 'double@test.com', password: 'pw', name: 'D' });
  const token = inviteMember('org-4', 'double@test.com', 'member');
  acceptInvite(token, user.id);
  let threw = false;
  try { acceptInvite(token, user.id); }
  catch { threw = true; }
  if (!threw) throw new Error('should throw for reuse');
  rmSync(dir, { recursive: true, force: true });
});

assert('listMembers returns org members', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  // Owner is automatically added when user is created
  const owner = createUser({ email: 'owner@test.com', password: 'pw', name: 'Owner' });
  const members = listMembers(owner.org_id);
  if (members.length < 1) throw new Error('should have at least owner');
  if (!members.some(m => m.userId === owner.id)) throw new Error('owner should be in members');
  rmSync(dir, { recursive: true, force: true });
});

assert('removeMember removes user from org', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const owner = createUser({ email: 'rm-owner@test.com', password: 'pw', name: 'O' });
  const member = createUser({ email: 'rm-member@test.com', password: 'pw', name: 'M' });
  const token = inviteMember(owner.org_id, 'rm-member@test.com', 'member');
  acceptInvite(token, member.id);
  const before = listMembers(owner.org_id);
  removeMember(owner.org_id, member.id);
  const after = listMembers(owner.org_id);
  if (after.some(m => m.userId === member.id)) throw new Error('member should be removed');
  rmSync(dir, { recursive: true, force: true });
});

assert('updateRole changes member role', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const owner = createUser({ email: 'role-owner@test.com', password: 'pw', name: 'O' });
  const member = createUser({ email: 'role-member@test.com', password: 'pw', name: 'M' });
  const token = inviteMember(owner.org_id, 'role-member@test.com', 'member');
  acceptInvite(token, member.id);
  updateRole(owner.org_id, member.id, 'admin');
  const members = listMembers(owner.org_id);
  const m = members.find(m => m.userId === member.id);
  if (!m || m.role !== 'admin') throw new Error(`expected admin, got ${m?.role}`);
  rmSync(dir, { recursive: true, force: true });
});

assert('inviteMember throws for missing orgId', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  let threw = false;
  try { inviteMember(null, 'x@x.com', 'member'); }
  catch { threw = true; }
  if (!threw) throw new Error('should throw for null orgId');
  rmSync(dir, { recursive: true, force: true });
});

assert('different orgs have separate member lists', () => {
  const dir = makeDataDir();
  process.env.AOAS_DATA_DIR = dir;
  const u1 = createUser({ email: 'sep1@test.com', password: 'pw', name: 'S1' });
  const u2 = createUser({ email: 'sep2@test.com', password: 'pw', name: 'S2' });
  const m1 = listMembers(u1.org_id);
  const m2 = listMembers(u2.org_id);
  if (m1.some(m => m.userId === u2.id)) throw new Error('org1 should not have org2 user');
  if (m2.some(m => m.userId === u1.id)) throw new Error('org2 should not have org1 user');
  rmSync(dir, { recursive: true, force: true });
});

assert('org-store module exports all required functions', () => {
  if (typeof inviteMember !== 'function') throw new Error('missing inviteMember');
  if (typeof acceptInvite !== 'function') throw new Error('missing acceptInvite');
  if (typeof removeMember !== 'function') throw new Error('missing removeMember');
  if (typeof updateRole !== 'function') throw new Error('missing updateRole');
  if (typeof listMembers !== 'function') throw new Error('missing listMembers');
});

console.log('\n' + '═'.repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log('═'.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
