import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TMP = join(tmpdir(), `config-test-${randomUUID().slice(0, 8)}`);
const OGU = join(TMP, '.ogu');

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(OGU, { recursive: true });
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

// Dynamic import (ESM)
const { loadConfig, saveConfig, validateConfig, getLoopConfig, getDefaultConfig } = await import('../lib/config.mjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    setup();
    fn();
    teardown();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n  config.mjs\n');

// ── getDefaultConfig ──

test('getDefaultConfig returns all loop configs', () => {
  const def = getDefaultConfig();
  assert.ok(def.loops.scheduler);
  assert.ok(def.loops.stateMachine);
  assert.ok(def.loops.consistency);
  assert.ok(def.loops.metricsAggregator);
  assert.ok(def.loops.circuitProber);
  assert.ok(def.loops.knowledge);
  assert.equal(def.version, 1);
});

test('getDefaultConfig returns deep clone (no mutation)', () => {
  const a = getDefaultConfig();
  const b = getDefaultConfig();
  a.api.port = 9999;
  assert.notEqual(b.api.port, 9999);
});

// ── loadConfig ──

test('loadConfig returns defaults when no file exists', () => {
  const config = loadConfig(TMP);
  assert.equal(config.api.port, 4210);
  assert.equal(config.runners.maxConcurrent, 4);
  assert.equal(config.loops.scheduler.enabled, true);
  assert.equal(config.version, 1);
});

test('loadConfig merges file values over defaults', () => {
  writeFileSync(join(OGU, 'kadima.config.json'), JSON.stringify({
    api: { port: 5000 },
    runners: { maxConcurrent: 8 },
  }), 'utf8');

  const config = loadConfig(TMP);
  assert.equal(config.api.port, 5000);
  assert.equal(config.runners.maxConcurrent, 8);
  // Defaults still present for unspecified fields
  assert.equal(config.api.host, '127.0.0.1');
  assert.equal(config.runners.timeoutMs, 600000);
});

test('loadConfig handles corrupt config file gracefully', () => {
  writeFileSync(join(OGU, 'kadima.config.json'), '{bad json', 'utf8');
  const config = loadConfig(TMP);
  // Should fall back to defaults
  assert.equal(config.api.port, 4210);
});

test('loadConfig applies programmatic overrides (highest priority)', () => {
  writeFileSync(join(OGU, 'kadima.config.json'), JSON.stringify({
    api: { port: 5000 },
  }), 'utf8');

  const config = loadConfig(TMP, { api: { port: 6000 } });
  assert.equal(config.api.port, 6000);
});

test('loadConfig applies env overrides', () => {
  const origPort = process.env.OGU_KADIMA_PORT;
  const origMax = process.env.OGU_KADIMA_MAX_RUNNERS;
  try {
    process.env.OGU_KADIMA_PORT = '7777';
    process.env.OGU_KADIMA_MAX_RUNNERS = '12';
    const config = loadConfig(TMP);
    assert.equal(config.api.port, 7777);
    assert.equal(config.runners.maxConcurrent, 12);
  } finally {
    if (origPort === undefined) delete process.env.OGU_KADIMA_PORT;
    else process.env.OGU_KADIMA_PORT = origPort;
    if (origMax === undefined) delete process.env.OGU_KADIMA_MAX_RUNNERS;
    else process.env.OGU_KADIMA_MAX_RUNNERS = origMax;
  }
});

test('loadConfig: programmatic overrides beat env overrides', () => {
  const orig = process.env.OGU_KADIMA_PORT;
  try {
    process.env.OGU_KADIMA_PORT = '7777';
    const config = loadConfig(TMP, { api: { port: 8888 } });
    assert.equal(config.api.port, 8888);
  } finally {
    if (orig === undefined) delete process.env.OGU_KADIMA_PORT;
    else process.env.OGU_KADIMA_PORT = orig;
  }
});

// ── saveConfig ──

test('saveConfig writes config to disk', () => {
  const config = { version: 1, api: { port: 4210 }, runners: {} };
  saveConfig(TMP, config);
  const saved = JSON.parse(readFileSync(join(OGU, 'kadima.config.json'), 'utf8'));
  assert.equal(saved.api.port, 4210);
});

test('saveConfig creates .ogu dir if missing', () => {
  const tmp2 = join(tmpdir(), `cfg-test2-${randomUUID().slice(0, 8)}`);
  rmSync(tmp2, { recursive: true, force: true });
  mkdirSync(tmp2, { recursive: true });
  saveConfig(tmp2, { version: 1, api: { port: 9090 } });
  assert.ok(existsSync(join(tmp2, '.ogu/kadima.config.json')));
  rmSync(tmp2, { recursive: true, force: true });
});

// ── validateConfig ──

test('validateConfig: valid config passes', () => {
  const result = validateConfig(getDefaultConfig());
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateConfig: invalid port', () => {
  const result = validateConfig({ api: { port: 99999 } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('Invalid port')));
});

test('validateConfig: same port and metricsPort', () => {
  const result = validateConfig({ api: { port: 4210, metricsPort: 4210 } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('must be different')));
});

test('validateConfig: negative maxConcurrent', () => {
  const result = validateConfig({ runners: { maxConcurrent: -1 } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('maxConcurrent')));
});

test('validateConfig: timeoutMs too small', () => {
  const result = validateConfig({ runners: { timeoutMs: 100 } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('timeoutMs')));
});

test('validateConfig: invalid spawnMode', () => {
  const result = validateConfig({ runners: { spawnMode: 'kubernetes' } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('spawnMode')));
});

test('validateConfig: loop intervalMs too small', () => {
  const result = validateConfig({ loops: { scheduler: { intervalMs: 100 } } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('scheduler')));
});

test('validateConfig: null config', () => {
  const result = validateConfig(null);
  assert.equal(result.valid, false);
});

test('validateConfig: cooldownMs too small', () => {
  const result = validateConfig({ circuitBreakers: { defaultCooldownMs: 100 } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('defaultCooldownMs')));
});

// ── getLoopConfig ──

test('getLoopConfig returns loop defaults', () => {
  const config = loadConfig(TMP);
  const scheduler = getLoopConfig(config, 'scheduler');
  assert.equal(scheduler.intervalMs, 5000);
  assert.equal(scheduler.enabled, true);
});

test('getLoopConfig returns knowledge loop defaults', () => {
  const config = loadConfig(TMP);
  const knowledge = getLoopConfig(config, 'knowledge');
  assert.equal(knowledge.intervalMs, 300000);
  assert.equal(knowledge.enabled, true);
});

test('getLoopConfig uses config overrides', () => {
  const config = loadConfig(TMP, { loops: { scheduler: { intervalMs: 2000 } } });
  const scheduler = getLoopConfig(config, 'scheduler');
  assert.equal(scheduler.intervalMs, 2000);
});

test('getLoopConfig handles unknown loop', () => {
  const config = loadConfig(TMP);
  const unknown = getLoopConfig(config, 'nonexistent');
  assert.equal(unknown.intervalMs, 30000);  // fallback default
  assert.equal(unknown.enabled, true);
});

// ── Deep merge behavior ──

test('deep merge preserves nested non-overridden fields', () => {
  writeFileSync(join(OGU, 'kadima.config.json'), JSON.stringify({
    loops: { scheduler: { intervalMs: 1000 } },
  }), 'utf8');

  const config = loadConfig(TMP);
  // scheduler.intervalMs overridden
  assert.equal(config.loops.scheduler.intervalMs, 1000);
  // scheduler.enabled preserved from defaults
  assert.equal(config.loops.scheduler.enabled, true);
  // Other loops preserved
  assert.ok(config.loops.stateMachine);
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
