/**
 * Egress Proxy Tests — network egress filtering for sandboxed agents.
 *
 * Run: node tools/ogu/tests/egress-proxy.test.mjs
 */

import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const { checkEgress, createEgressProxy, logEgressAttempt, getEgressLog } =
  await import('../commands/lib/egress-proxy.mjs');

const testRoot = join(tmpdir(), `ogu-egress-test-${randomUUID().slice(0, 8)}`);
mkdirSync(testRoot, { recursive: true });

console.log('\nEgress Proxy Tests\n');

// ── checkEgress ──

test('1. checkEgress: no policy → blocked', () => {
  const r = checkEgress('https://example.com', null);
  assert(r.allowed === false, 'Should be blocked');
  assert(r.reason.includes('No policy'), 'Should mention no policy');
});

test('2. checkEgress: networkAccess=none → blocked', () => {
  const r = checkEgress('https://example.com', { networkAccess: 'none' });
  assert(r.allowed === false, 'Should be blocked');
});

test('3. checkEgress: networkAccess=deny → blocked', () => {
  const r = checkEgress('https://example.com', { networkAccess: 'deny' });
  assert(r.allowed === false, 'Should be blocked');
});

test('4. checkEgress: networkAccess=allow → allowed', () => {
  const r = checkEgress('https://example.com', { networkAccess: 'allow' });
  assert(r.allowed === true, 'Should be allowed');
});

test('5. checkEgress: networkAccess=full → allowed', () => {
  const r = checkEgress('https://anything.io/path', { networkAccess: 'full' });
  assert(r.allowed === true, 'Should be allowed');
});

test('6. checkEgress: allowlist exact domain match', () => {
  const policy = { networkAccess: 'allowlist', networkAllowlist: ['api.github.com', 'npmjs.org'] };
  const r = checkEgress('https://api.github.com/repos', policy);
  assert(r.allowed === true, 'Should match exact domain');
  assert(r.reason.includes('api.github.com'), 'Should mention matched domain');
});

test('7. checkEgress: allowlist wildcard match', () => {
  const policy = { networkAccess: 'allowlist', networkAllowlist: ['*.github.com'] };
  const r = checkEgress('https://api.github.com/repos', policy);
  assert(r.allowed === true, 'Should match wildcard');
});

test('8. checkEgress: allowlist URL prefix match', () => {
  const policy = { networkAccess: 'allowlist', networkAllowlist: ['https://registry.npmjs.org'] };
  const r = checkEgress('https://registry.npmjs.org/express', policy);
  assert(r.allowed === true, 'Should match URL prefix');
});

test('9. checkEgress: allowlist no match → blocked', () => {
  const policy = { networkAccess: 'allowlist', networkAllowlist: ['api.github.com'] };
  const r = checkEgress('https://evil.com/steal', policy);
  assert(r.allowed === false, 'Should be blocked');
  assert(r.reason.includes('not in allowlist'), 'Should mention not in allowlist');
});

test('10. checkEgress: allowlist empty → all blocked', () => {
  const policy = { networkAccess: 'allowlist', networkAllowlist: [] };
  const r = checkEgress('https://example.com', policy);
  assert(r.allowed === false, 'Should be blocked with empty allowlist');
});

test('11. checkEgress: localhost mode allows localhost', () => {
  const policy = { networkAccess: 'localhost' };
  const r1 = checkEgress('http://localhost:3000/api', policy);
  assert(r1.allowed === true, 'localhost should be allowed');

  const r2 = checkEgress('http://127.0.0.1:8080', policy);
  assert(r2.allowed === true, '127.0.0.1 should be allowed');

  const r3 = checkEgress('http://[::1]:3000', policy);
  assert(r3.allowed === true, '::1 should be allowed');
});

test('12. checkEgress: localhost mode blocks external', () => {
  const policy = { networkAccess: 'localhost' };
  const r = checkEgress('https://api.github.com', policy);
  assert(r.allowed === false, 'External should be blocked in localhost mode');
});

test('13. checkEgress: invalid URL → blocked', () => {
  const policy = { networkAccess: 'allowlist', networkAllowlist: ['example.com'] };
  const r = checkEgress('not a url', policy);
  assert(r.allowed === false, 'Invalid URL should be blocked');
  assert(r.reason.includes('Invalid URL'), 'Should mention invalid URL');
});

test('14. checkEgress: unknown policy → blocked', () => {
  const r = checkEgress('https://example.com', { networkAccess: 'custom-unknown' });
  assert(r.allowed === false, 'Unknown policy should block');
  assert(r.reason.includes('Unknown'), 'Should mention unknown');
});

test('15. checkEgress: missing networkAccess defaults to none', () => {
  const r = checkEgress('https://example.com', {});
  assert(r.allowed === false, 'Default should be none (blocked)');
});

// ── createEgressProxy ──

test('16. createEgressProxy returns a function', () => {
  const proxy = createEgressProxy({ networkAccess: 'none' });
  assert(typeof proxy === 'function', 'Should return a function');
});

test('17. createEgressProxy checks egress correctly', () => {
  const proxy = createEgressProxy({ networkAccess: 'allow' });
  const r = proxy('https://example.com');
  assert(r.allowed === true, 'Should be allowed');
});

test('18. createEgressProxy with context logs attempts', () => {
  const proxy = createEgressProxy(
    { networkAccess: 'none' },
    { root: testRoot, taskId: 'proxy-test', featureSlug: 'auth', roleId: 'backend-dev' },
  );

  proxy('https://blocked.com');

  // Check log was written
  const log = getEgressLog(testRoot, 'proxy-test');
  assert(log.length >= 1, 'Should have logged the attempt');
  assert(log[0].url === 'https://blocked.com', 'Should log the URL');
  assert(log[0].allowed === false, 'Should log as blocked');
});

// ── logEgressAttempt & getEgressLog ──

test('19. logEgressAttempt creates log file', () => {
  logEgressAttempt(testRoot, {
    url: 'https://api.test.com',
    allowed: true,
    reason: 'Test allowed',
    taskId: 'log-test-1',
  });

  const log = getEgressLog(testRoot, 'log-test-1');
  assert(log.length === 1, 'Should have 1 entry');
  assert(log[0].url === 'https://api.test.com', 'Should have URL');
  assert(log[0].allowed === true, 'Should be allowed');
  assert(log[0].timestamp, 'Should have timestamp');
});

test('20. logEgressAttempt appends to existing log', () => {
  logEgressAttempt(testRoot, { url: 'https://first.com', allowed: true, reason: 'ok', taskId: 'append-test' });
  logEgressAttempt(testRoot, { url: 'https://second.com', allowed: false, reason: 'blocked', taskId: 'append-test' });
  logEgressAttempt(testRoot, { url: 'https://third.com', allowed: true, reason: 'ok', taskId: 'append-test' });

  const log = getEgressLog(testRoot, 'append-test');
  assert(log.length === 3, `Expected 3 entries, got ${log.length}`);
  assert(log[0].url === 'https://first.com', 'First entry correct');
  assert(log[1].url === 'https://second.com', 'Second entry correct');
  assert(log[2].url === 'https://third.com', 'Third entry correct');
});

test('21. logEgressAttempt without taskId writes to general.jsonl', () => {
  logEgressAttempt(testRoot, { url: 'https://general.com', allowed: true, reason: 'ok' });

  const generalPath = join(testRoot, '.ogu/egress/general.jsonl');
  assert(existsSync(generalPath), 'general.jsonl should exist');
  const lines = readFileSync(generalPath, 'utf8').trim().split('\n').filter(Boolean);
  assert(lines.length >= 1, 'Should have at least 1 line');
});

test('22. getEgressLog returns empty for nonexistent task', () => {
  const log = getEgressLog(testRoot, 'nonexistent-task');
  assert(log.length === 0, 'Should return empty array');
});

test('23. getEgressLog returns empty for nonexistent root', () => {
  const log = getEgressLog('/nonexistent/path', 'any-task');
  assert(log.length === 0, 'Should return empty array');
});

// ── Cleanup ──

try { rmSync(testRoot, { recursive: true, force: true }); } catch { /* best effort */ }

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
