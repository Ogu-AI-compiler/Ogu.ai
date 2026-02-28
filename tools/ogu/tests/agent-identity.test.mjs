/**
 * Agent Identity Tests — creation, sessions, revocation, verification.
 *
 * Run: node tools/ogu/tests/agent-identity.test.mjs
 */

import { mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const {
  createIdentity, loadCredential, startSession, endSession,
  createSession, getActiveSession, validateCapability,
  revokeAgent, isRevoked, verifyCredential,
  checkSessionHealth, listActiveSessions,
} = await import('../commands/lib/agent-identity.mjs');

// ── Setup ──

const testRoot = join(tmpdir(), `ogu-identity-test-${randomUUID().slice(0, 8)}`);
const orgSpec = {
  $schema: 'OrgSpec/1.0',
  org: { name: 'test-org', version: '1.0.0' },
  roles: [
    {
      roleId: 'backend-dev',
      id: 'backend-dev',
      name: 'Backend Developer',
      department: 'engineering',
      capabilities: ['code_generation', 'testing'],
      allowedCommands: ['build', 'test'],
      ownershipScope: ['src/**'],
      allowedTools: [],
      allowedSecrets: [],
      riskTier: 'medium',
      enabled: true,
    },
    {
      roleId: 'reviewer',
      id: 'reviewer',
      name: 'Code Reviewer',
      department: 'qa',
      capabilities: ['code_review'],
      enabled: true,
    },
    {
      roleId: 'disabled-agent',
      id: 'disabled-agent',
      name: 'Disabled',
      department: 'engineering',
      capabilities: ['code_generation'],
      enabled: false,
    },
  ],
};

mkdirSync(join(testRoot, '.ogu'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/agents/sessions'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/agents/credentials'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/agents/revoked'), { recursive: true });
mkdirSync(join(testRoot, '.ogu/quarantine'), { recursive: true });
writeFileSync(join(testRoot, '.ogu/OrgSpec.json'), JSON.stringify(orgSpec, null, 2));

// Force OGU_ROOT for the tests
const origRoot = process.env.OGU_ROOT;
process.env.OGU_ROOT = testRoot;

console.log('\nAgent Identity Tests\n');

// ── Section 1: createIdentity ──

let agentId1;

test('1. createIdentity — creates credential for valid role', () => {
  const cred = createIdentity(testRoot, 'backend-dev');
  assert(cred.agentId, 'Should have agentId');
  assert(cred.roleId === 'backend-dev');
  assert(cred.$schema === 'AgentIdentity/1.0');
  assert(cred.capabilities.includes('code_generation'));
  assert(cred.signature);
  agentId1 = cred.agentId;
});

test('2. createIdentity — agentId format: orgHash:roleId:instanceHash', () => {
  const parts = agentId1.split(':');
  assert(parts.length === 3, `Expected 3 parts, got ${parts.length}`);
  assert(parts[1] === 'backend-dev');
});

test('3. createIdentity — writes credential file to disk', () => {
  const credDir = join(testRoot, '.ogu/agents/credentials');
  const files = readdirSync(credDir).filter(f => f.endsWith('.json'));
  assert(files.length >= 1, 'Should have at least 1 credential file');
});

test('4. createIdentity — throws for unknown role', () => {
  let threw = false;
  try { createIdentity(testRoot, 'nonexistent-role'); } catch (e) {
    threw = true;
    assert(e.message.includes('OGU3901'));
  }
  assert(threw);
});

test('5. createIdentity — permissions from role', () => {
  const cred = loadCredential(testRoot, agentId1);
  assert(cred.permissions.commands.includes('build'));
  assert(cred.permissions.paths.includes('src/**'));
});

// ── Section 2: loadCredential ──

test('6. loadCredential — loads saved credential', () => {
  const cred = loadCredential(testRoot, agentId1);
  assert(cred);
  assert(cred.agentId === agentId1);
  assert(cred.roleId === 'backend-dev');
});

test('7. loadCredential — returns null for missing', () => {
  assert(loadCredential(testRoot, 'no:such:agent') === null);
});

// ── Section 3: startSession (v2) ──

test('8. startSession — creates session on credential', () => {
  const session = startSession(testRoot, agentId1, { taskId: 'task-1', featureSlug: 'my-feat' });
  assert(session.sessionId);
  assert(session.taskId === 'task-1');
  assert(session.featureSlug === 'my-feat');
  assert(session.state === 'active');
});

test('9. startSession — credential now has session', () => {
  const cred = loadCredential(testRoot, agentId1);
  assert(cred.session);
  assert(cred.session.state === 'active');
});

test('10. startSession — throws for nonexistent agent', () => {
  let threw = false;
  try { startSession(testRoot, 'no:such:agent', { taskId: 't', featureSlug: 'f' }); } catch (e) {
    threw = true;
    assert(e.message.includes('OGU3902'));
  }
  assert(threw);
});

// ── Section 4: createSession (legacy) ──

test('11. createSession — creates session file', () => {
  const session = createSession({ roleId: 'reviewer', featureSlug: 'feat-x', taskId: 'task-x', root: testRoot });
  assert(session.sessionId);
  assert(session.roleId === 'reviewer');
  assert(session.status === 'active');
});

test('12. createSession — throws if role already has active session', () => {
  let threw = false;
  try { createSession({ roleId: 'reviewer', featureSlug: 'feat-y', taskId: 'task-y', root: testRoot }); } catch {
    threw = true;
  }
  assert(threw, 'Should reject duplicate active session');
});

// ── Section 5: getActiveSession ──

test('13. getActiveSession — finds active session for role', () => {
  const session = getActiveSession({ roleId: 'reviewer', root: testRoot });
  assert(session);
  assert(session.roleId === 'reviewer');
  assert(session.featureSlug === 'feat-x');
});

test('14. getActiveSession — returns null for inactive role', () => {
  assert(getActiveSession({ roleId: 'nonexistent', root: testRoot }) === null);
});

// ── Section 6: endSession ──

test('15. endSession — marks session as completed', () => {
  const active = getActiveSession({ roleId: 'reviewer', root: testRoot });
  const ended = endSession({ sessionId: active.sessionId, status: 'completed', root: testRoot });
  assert(ended);
  assert(ended.status === 'completed');
  assert(ended.endedAt);
});

test('16. endSession — no more active session for role', () => {
  assert(getActiveSession({ roleId: 'reviewer', root: testRoot }) === null);
});

// ── Section 7: validateCapability ──

test('17. validateCapability — valid for matching capability', () => {
  const result = validateCapability({ session: { roleId: 'backend-dev' }, capability: 'code_generation', root: testRoot });
  assert(result.valid === true);
});

test('18. validateCapability — invalid for missing capability', () => {
  const result = validateCapability({ session: { roleId: 'backend-dev' }, capability: 'deploy', root: testRoot });
  assert(result.valid === false);
  assert(result.reason.includes('lacks capability'));
});

test('19. validateCapability — invalid for disabled role', () => {
  const result = validateCapability({ session: { roleId: 'disabled-agent' }, capability: 'code_generation', root: testRoot });
  assert(result.valid === false);
  assert(result.reason.includes('disabled'));
});

// ── Section 8: revokeAgent ──

let agentId2;

test('20. revokeAgent — creates revocation file', () => {
  const cred2 = createIdentity(testRoot, 'reviewer');
  agentId2 = cred2.agentId;
  const revocation = revokeAgent(testRoot, agentId2, { reason: 'testing', revokedBy: 'admin' });
  assert(revocation.agentId === agentId2);
  assert(revocation.reason === 'testing');
  assert(revocation.revokedBy === 'admin');
});

test('21. isRevoked — true for revoked agent', () => {
  assert(isRevoked(testRoot, agentId2));
});

test('22. isRevoked — false for non-revoked agent', () => {
  assert(!isRevoked(testRoot, agentId1));
});

test('23. startSession — throws for revoked agent', () => {
  let threw = false;
  try { startSession(testRoot, agentId2, { taskId: 't', featureSlug: 'f' }); } catch (e) {
    threw = true;
    assert(e.message.includes('OGU3903'));
  }
  assert(threw);
});

// ── Section 9: verifyCredential ──

test('24. verifyCredential — valid for good agent', () => {
  const result = verifyCredential(testRoot, agentId1);
  assert(result.valid === true);
  assert(result.credential);
});

test('25. verifyCredential — invalid for revoked agent', () => {
  const result = verifyCredential(testRoot, agentId2);
  assert(result.valid === false);
  assert(result.error === 'Agent revoked');
});

test('26. verifyCredential — invalid for nonexistent', () => {
  const result = verifyCredential(testRoot, 'no:such:agent');
  assert(result.valid === false);
});

// ── Section 10: checkSessionHealth ──

test('27. checkSessionHealth — alive for active session', () => {
  const health = checkSessionHealth(testRoot, agentId1);
  assert(health.alive === true);
  assert(health.state === 'active');
});

test('28. checkSessionHealth — no_session for agent without session', () => {
  const cred3 = createIdentity(testRoot, 'backend-dev');
  const health = checkSessionHealth(testRoot, cred3.agentId);
  assert(health.alive === false);
  assert(health.reason === 'no_session');
});

// ── Section 11: listActiveSessions ──

test('29. listActiveSessions — returns list', () => {
  const sessions = listActiveSessions(testRoot);
  assert(Array.isArray(sessions));
  assert(sessions.length >= 1);
});

// ── Cleanup ──

process.env.OGU_ROOT = origRoot;
rmSync(testRoot, { recursive: true, force: true });

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
