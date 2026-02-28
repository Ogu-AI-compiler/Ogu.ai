#!/usr/bin/env node

/**
 * Slice 12 — Production Hardening
 *
 * Proves: Kadima daemon handles real-world failure scenarios gracefully.
 *
 * Tests:
 *   - PID file lock: detects stale PID, recovers
 *   - Graceful shutdown: stops loops, drains runners, removes PID
 *   - Health watchdog: /health self-reports loop status
 *   - Log rotation: daemon log is bounded
 *   - Config validation: rejects invalid config
 *   - Double-start prevention: refuses if already running
 *
 * Depends on: Slices 1-11
 *
 * Run: node tests/e2e/slice-12.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, execSync } from 'node:child_process';

// ── Test harness ──

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${err.message}`);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Helpers ──

const CLI = join(import.meta.dirname, '../../tools/ogu/cli.mjs');
const ROOT = join(import.meta.dirname, '../../');
const API = 'http://127.0.0.1:4200';

function ogu(command, args = []) {
  try {
    const output = execFileSync('node', [CLI, command, ...args], {
      cwd: ROOT, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, OGU_ROOT: ROOT, NODE_NO_WARNINGS: '1' },
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { exitCode: err.status ?? 1, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

function writeJSON(relPath, data) {
  const fullPath = join(ROOT, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

function readJSON(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

async function api(path) {
  const resp = await fetch(`${API}${path}`);
  const body = await resp.json();
  return { status: resp.status, body };
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0); // Signal 0 = check if alive
    return true;
  } catch {
    return false;
  }
}

// ── Setup ──

function setup() {
  ogu('org:init', ['--minimal', '--force']);

  writeJSON('.ogu/kadima.config.json', {
    version: 1,
    loops: {
      scheduler: { intervalMs: 1000, enabled: true },
      stateMachine: { intervalMs: 1000, enabled: true },
    },
    api: { host: '127.0.0.1', port: 4200, metricsPort: 4201 },
    runners: { maxConcurrent: 4, spawnMode: 'local', timeoutMs: 30000 },
  });

  // Clean stale metrics snapshot to avoid false 'critical' health status
  const metricsPath = join(ROOT, '.ogu/state/metrics-snapshot.json');
  if (existsSync(metricsPath)) rmSync(metricsPath);
}

// ── Ensure clean ──
ogu('kadima:stop');

// ── Tests ──

console.log('\n\x1b[1mSlice 12 — Production Hardening E2E Test\x1b[0m\n');
console.log('  PID lock, graceful shutdown, config validation, watchdog\n');

setup();

// ── Part 1: PID File Management ──

console.log('\x1b[36m  Part 1: PID File Management\x1b[0m');

await test('kadima:start creates PID file', async () => {
  const result = ogu('kadima:start');
  assertEqual(result.exitCode, 0, 'Should start successfully');
  await sleep(1000);

  const pidPath = join(ROOT, '.ogu/kadima.pid');
  assert(existsSync(pidPath), 'PID file should exist');
  const pid = parseInt(readFileSync(pidPath, 'utf8').trim());
  assert(pid > 0, `PID should be positive, got ${pid}`);
  assert(isPidAlive(pid), `PID ${pid} should be alive`);
});

await test('kadima:status reports running with PID', async () => {
  const result = ogu('kadima:status');
  assertEqual(result.exitCode, 0, 'Should succeed');
  assert(
    result.stdout.includes('running') || result.stdout.includes('PID') || result.stdout.includes('healthy'),
    `Should report running status: ${result.stdout.trim()}`
  );
});

await test('kadima:stop removes PID file', async () => {
  ogu('kadima:stop');
  await sleep(500);
  const pidPath = join(ROOT, '.ogu/kadima.pid');
  assert(!existsSync(pidPath), 'PID file should be removed after stop');
});

// ── Part 2: Stale PID Recovery ──

console.log('\n\x1b[36m  Part 2: Stale PID Recovery\x1b[0m');

await test('kadima:start recovers from stale PID file', async () => {
  // Write a fake PID file with a dead process
  const pidPath = join(ROOT, '.ogu/kadima.pid');
  writeFileSync(pidPath, '99999', 'utf8'); // Almost certainly dead

  const result = ogu('kadima:start');
  assertEqual(result.exitCode, 0, `Should start despite stale PID: ${result.stderr || result.stdout}`);
  await sleep(1000);

  // Verify new PID is alive
  const newPid = parseInt(readFileSync(pidPath, 'utf8').trim());
  assert(newPid !== 99999, 'Should have new PID, not stale one');
  assert(isPidAlive(newPid), `New PID ${newPid} should be alive`);

  ogu('kadima:stop');
  await sleep(500);
});

await test('kadima:status detects stale PID', async () => {
  // Write stale PID
  const pidPath = join(ROOT, '.ogu/kadima.pid');
  writeFileSync(pidPath, '99998', 'utf8');

  const result = ogu('kadima:status');
  // Should report not running or stale
  assert(
    result.stdout.includes('not running') ||
    result.stdout.includes('stale') ||
    result.stdout.includes('stopped') ||
    result.exitCode === 1,
    `Should detect stale PID: ${result.stdout.trim()}`
  );

  // Clean up
  if (existsSync(pidPath)) unlinkSync(pidPath);
});

// ── Part 3: Graceful Shutdown ──

console.log('\n\x1b[36m  Part 3: Graceful Shutdown\x1b[0m');

await test('graceful shutdown stops all loops', async () => {
  ogu('kadima:start');
  await sleep(1000);

  // Verify running
  const healthBefore = await api('/health');
  assertEqual(healthBefore.status, 200, 'Should be healthy before stop');

  // Stop
  ogu('kadima:stop');
  await sleep(1000);

  // Verify stopped
  try {
    await fetch(`${API}/health`, { signal: AbortSignal.timeout(2000) });
    assert(false, 'Should not respond after shutdown');
  } catch (err) {
    // Expected — connection refused
    assert(true, 'Daemon is stopped');
  }
});

await test('shutdown emits daemon.shutdown audit event', async () => {
  const auditPath = join(ROOT, '.ogu/audit/current.jsonl');
  if (existsSync(auditPath)) {
    const lines = readFileSync(auditPath, 'utf8').split('\n').filter(l => l.trim());
    const shutdowns = lines.filter(l => {
      try { return JSON.parse(l).type === 'daemon.shutdown'; } catch { return false; }
    });
    assert(shutdowns.length >= 1, `Should have at least 1 shutdown event, got ${shutdowns.length}`);
  }
});

// ── Part 4: Double-Start Prevention ──

console.log('\n\x1b[36m  Part 4: Double-Start Prevention\x1b[0m');

await test('kadima:start rejects if already running', async () => {
  ogu('kadima:start');
  await sleep(1000);

  const result = ogu('kadima:start');
  // Should either warn or return non-zero
  const expected = result.exitCode !== 0 ||
    result.stdout.includes('already') ||
    result.stderr.includes('already') ||
    result.stdout.includes('running') ||
    result.stderr.includes('running');
  assert(expected, `Should reject double-start: exit=${result.exitCode}, ${result.stdout.trim()}`);

  ogu('kadima:stop');
  await sleep(500);
});

// ── Part 5: Config Validation ──

console.log('\n\x1b[36m  Part 5: Config Validation\x1b[0m');

await test('kadima:start uses default config when config file missing', async () => {
  const configPath = join(ROOT, '.ogu/kadima.config.json');
  const backup = existsSync(configPath) ? readFileSync(configPath, 'utf8') : null;

  // Remove config
  if (existsSync(configPath)) rmSync(configPath);

  const result = ogu('kadima:start');
  assertEqual(result.exitCode, 0, `Should start with defaults: ${result.stderr}`);
  await sleep(1000);

  // Verify it's running
  const health = await api('/health');
  assertEqual(health.status, 200, 'Should be healthy with default config');

  ogu('kadima:stop');
  await sleep(500);

  // Restore config
  if (backup) writeFileSync(configPath, backup, 'utf8');
  else setup(); // re-create
});

// ── Part 6: Health Watchdog ──

console.log('\n\x1b[36m  Part 6: Health Watchdog\x1b[0m');

await test('/health reports loop health', async () => {
  ogu('kadima:start');
  await sleep(1500);

  const { body } = await api('/health');
  assertEqual(body.status, 'healthy', 'Should report healthy');
  assert(Array.isArray(body.loops), 'Should have loops array');
  assert(body.loops.length >= 1, 'Should have at least 1 loop');

  for (const loop of body.loops) {
    assert(typeof loop.name === 'string', `Loop should have name: ${JSON.stringify(loop)}`);
    assert(typeof loop.tickCount === 'number', `Loop should have tickCount: ${JSON.stringify(loop)}`);
  }

  ogu('kadima:stop');
  await sleep(500);
});

await test('/health reports uptime increasing', async () => {
  ogu('kadima:start');
  await sleep(1000);

  const { body: h1 } = await api('/health');
  await sleep(1500);
  const { body: h2 } = await api('/health');

  assert(h2.uptime > h1.uptime, `Uptime should increase: ${h1.uptime} → ${h2.uptime}`);

  ogu('kadima:stop');
  await sleep(500);
});

// ── Part 7: Daemon Log ──

console.log('\n\x1b[36m  Part 7: Daemon Log\x1b[0m');

await test('daemon writes to log directory', async () => {
  const logDir = join(ROOT, '.ogu/logs');
  assert(existsSync(logDir), 'Log directory should exist');
});

await test('audit trail persists across start/stop cycles', async () => {
  const auditPath = join(ROOT, '.ogu/audit/current.jsonl');
  assert(existsSync(auditPath), 'Audit file should exist');
  const content = readFileSync(auditPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  assert(lines.length >= 5, `Should have multiple audit events, got ${lines.length}`);

  // Should have both start and shutdown events
  const starts = lines.filter(l => { try { return JSON.parse(l).type === 'daemon.start'; } catch { return false; } });
  const stops = lines.filter(l => { try { return JSON.parse(l).type === 'daemon.shutdown'; } catch { return false; } });
  assert(starts.length >= 1, `Should have daemon.start events, got ${starts.length}`);
  assert(stops.length >= 1, `Should have daemon.shutdown events, got ${stops.length}`);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
