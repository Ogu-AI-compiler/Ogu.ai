/**
 * Enriched Health Endpoint Test.
 *
 * Tests that /health and /api/dashboard include circuit breakers, freeze, org health.
 *
 * Run: node tools/kadima/tests/enriched-health.test.mjs
 */

import http from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

let passed = 0;
let failed = 0;

async function asyncTest(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function httpGet(port, path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    }).on('error', reject);
  });
}

// ── Setup ──

mkdirSync(join(root, '.ogu/state'), { recursive: true });

const breakerPath = join(root, '.ogu/state/circuit-breakers.json');
const freezePath = join(root, '.ogu/state/company-freeze.json');
const metricsPath = join(root, '.ogu/state/metrics-snapshot.json');

const backups = {};
for (const p of [breakerPath, freezePath, metricsPath]) {
  if (existsSync(p)) backups[p] = readFileSync(p, 'utf8');
}

// Write test data
writeFileSync(breakerPath, JSON.stringify({
  'FD-PROVIDER': { state: 'closed', failureCount: 0 },
  'FD-FILESYSTEM': { state: 'open', failureCount: 3 },
}, null, 2), 'utf8');

writeFileSync(freezePath, JSON.stringify({ frozen: false }), 'utf8');

writeFileSync(metricsPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  health: { score: 78, status: 'degraded' },
  scheduler: { total: 5 },
}, null, 2), 'utf8');

// Create test server
const { createApiRouter } = await import('../api/router.mjs');
const { createBroadcaster } = await import('../api/event-stream.mjs');

const broadcaster = createBroadcaster();
const mockRunnerPool = {
  active: new Map(),
  availableSlots() { return 4; },
  status() { return { maxConcurrent: 4, active: 0, available: 4, tasks: [] }; },
};

const consistencyReport = {
  issues: [{ type: 'stale_dispatch', taskId: 't1' }],
  timestamp: new Date().toISOString(),
};

const mockLoops = [
  { name: 'scheduler', isRunning: true, lastTick: new Date().toISOString(), tickCount: 10, stop() {}, async forceTick() {} },
  { name: 'state-machine', isRunning: true, lastTick: new Date().toISOString(), tickCount: 5, stop() {}, async forceTick() {} },
  { name: 'consistency', isRunning: true, lastTick: new Date().toISOString(), tickCount: 3, lastReport: consistencyReport, stop() {}, async forceTick() {} },
];

const router = createApiRouter({
  root, runnerPool: mockRunnerPool, loops: mockLoops,
  emitAudit: () => {}, config: {}, broadcaster,
});

const server = http.createServer(router);
const PORT = 14201;
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

console.log('\nEnriched Health Endpoint Tests\n');

// ── Tests ──

await asyncTest('1. /health includes circuitBreakers', async () => {
  const res = await httpGet(PORT, '/health');
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.circuitBreakers, 'Should have circuitBreakers');
  assert(res.body.circuitBreakers.openCount === 1, `Expected 1 open breaker, got ${res.body.circuitBreakers.openCount}`);
  assert(res.body.circuitBreakers.domains['FD-FILESYSTEM'].state === 'open', 'FD-FILESYSTEM should be open');
  assert(res.body.circuitBreakers.domains['FD-PROVIDER'].state === 'closed', 'FD-PROVIDER should be closed');
});

await asyncTest('2. /health includes freeze status', async () => {
  const res = await httpGet(PORT, '/health');
  assert(res.body.freeze, 'Should have freeze');
  assert(res.body.freeze.frozen === false, 'Should not be frozen');
});

await asyncTest('3. /health includes org health score', async () => {
  const res = await httpGet(PORT, '/health');
  assert(res.body.orgHealth, 'Should have orgHealth');
  assert(res.body.orgHealth.score === 78, `Expected score 78, got ${res.body.orgHealth.score}`);
  assert(res.body.orgHealth.status === 'degraded', 'Should be degraded');
});

await asyncTest('4. /health includes consistency report', async () => {
  const res = await httpGet(PORT, '/health');
  assert(res.body.consistency, 'Should have consistency');
  assert(res.body.consistency.issues.length === 1, 'Should have 1 issue');
});

await asyncTest('5. /health status reflects open circuit breaker', async () => {
  const res = await httpGet(PORT, '/health');
  assert(res.body.status === 'degraded', `Expected degraded (open breaker), got ${res.body.status}`);
});

await asyncTest('6. /health status reflects blocked system', async () => {
  writeFileSync(join(root, '.ogu/state/system-halt.json'), JSON.stringify({ halted: true, reason: 'test' }), 'utf8');
  const res = await httpGet(PORT, '/health');
  assert(res.body.status === 'blocked', `Expected blocked, got ${res.body.status}`);
  writeFileSync(join(root, '.ogu/state/system-halt.json'), JSON.stringify({ halted: false }), 'utf8');
});

await asyncTest('7. /api/dashboard includes circuitBreakers and freeze', async () => {
  const res = await httpGet(PORT, '/api/dashboard');
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  assert(res.body.circuitBreakers, 'Dashboard should have circuitBreakers');
  assert(res.body.freeze, 'Dashboard should have freeze');
  assert(res.body.orgHealth, 'Dashboard should have orgHealth');
});

await asyncTest('8. /health still includes all original fields', async () => {
  const res = await httpGet(PORT, '/health');
  assert(typeof res.body.uptime === 'number', 'Should have uptime');
  assert(typeof res.body.pid === 'number', 'Should have pid');
  assert(res.body.loops.length === 3, `Expected 3 loops, got ${res.body.loops.length}`);
  assert(res.body.runners, 'Should have runners');
  assert(res.body.memory, 'Should have memory');
});

// ── Cleanup ──

server.close();

for (const [p, content] of Object.entries(backups)) {
  writeFileSync(p, content, 'utf8');
}

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
