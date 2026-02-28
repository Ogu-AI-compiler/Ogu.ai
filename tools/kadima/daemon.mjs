#!/usr/bin/env node

/**
 * Kadima Daemon — The Control Plane.
 *
 * Long-running background process that:
 * - Runs the scheduler loop (picks tasks, dispatches to runners)
 * - Runs the state machine loop (auto-transitions)
 * - Serves an HTTP API for CLI and Studio
 * - Manages the runner pool
 *
 * Started by: ogu kadima:start
 * Stopped by: ogu kadima:stop (sends SIGTERM)
 */

import { createServer } from 'node:http';
import { writeFileSync, unlinkSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createSchedulerLoop } from './loops/scheduler.mjs';
import { createStateMachineLoop } from './loops/state-machine.mjs';
import { createConsistencyLoop } from './loops/consistency.mjs';
import { createMetricsAggregatorLoop } from './loops/metrics-aggregator.mjs';
import { createCircuitProberLoop } from './loops/circuit-prober.mjs';
import { createKnowledgeLoop } from './loops/knowledge.mjs';
import { RunnerPool } from './runners/pool.mjs';
import { createApiRouter } from './api/router.mjs';
import { createBroadcaster } from './api/event-stream.mjs';

// ── Resolve project root ──
const ROOT = process.env.OGU_ROOT || process.cwd();
const OGU_DIR = join(ROOT, '.ogu');
const PID_FILE = join(OGU_DIR, 'kadima.pid');
const CONFIG_FILE = join(OGU_DIR, 'kadima.config.json');
const LOG_FILE = join(OGU_DIR, 'logs/kadima.log');

// ── Ensure directories ──
for (const dir of ['logs', 'runners', 'state', 'audit']) {
  mkdirSync(join(OGU_DIR, dir), { recursive: true });
}

// ── Load config ──
let config;
if (existsSync(CONFIG_FILE)) {
  config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
} else {
  config = {
    version: 1,
    loops: {
      scheduler: { intervalMs: 5000, enabled: true },
      stateMachine: { intervalMs: 10000, enabled: true },
    },
    api: { host: '127.0.0.1', port: 4200, metricsPort: 4201 },
    runners: { maxConcurrent: 4, spawnMode: 'local', timeoutMs: 600000 },
  };
}

// ── SSE Broadcaster ──
const broadcaster = createBroadcaster();

// ── Audit helper ──
import { appendFileSync } from 'node:fs';

function emitAudit(type, payload) {
  const event = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    severity: 'info',
    source: 'kadima',
    actor: { type: 'system', id: 'kadima-daemon' },
    payload,
  };
  const auditFile = join(OGU_DIR, 'audit/current.jsonl');
  appendFileSync(auditFile, JSON.stringify(event) + '\n', 'utf8');

  // Broadcast to connected SSE clients
  broadcaster.broadcast({
    type,
    timestamp: event.timestamp,
    payload,
    feature: payload?.featureSlug || payload?.slug || undefined,
  });

  return event;
}

// ── Write PID ──
writeFileSync(PID_FILE, String(process.pid), 'utf8');
emitAudit('daemon.start', { pid: process.pid, config });

// ── Runner pool ──
const runnerPool = new RunnerPool({
  root: ROOT,
  maxConcurrent: config.runners.maxConcurrent,
  timeoutMs: config.runners.timeoutMs,
  emitAudit,
});

// ── Start loops ──
const loops = [];

if (config.loops.scheduler?.enabled) {
  const schedulerLoop = createSchedulerLoop({
    root: ROOT,
    intervalMs: config.loops.scheduler.intervalMs,
    runnerPool,
    emitAudit,
  });
  loops.push(schedulerLoop);
}

if (config.loops.stateMachine?.enabled) {
  const smLoop = createStateMachineLoop({
    root: ROOT,
    intervalMs: config.loops.stateMachine.intervalMs,
    emitAudit,
  });
  loops.push(smLoop);
}

// Consistency reconciler — detects orphaned tasks, stale dispatches, state drift
if (config.loops.consistency?.enabled !== false) {
  const consistencyLoop = createConsistencyLoop({
    root: ROOT,
    intervalMs: config.loops.consistency?.intervalMs || 30000,
    runnerPool,
    emitAudit,
  });
  loops.push(consistencyLoop);
}

// Metrics aggregator — periodic health score computation
if (config.loops.metricsAggregator?.enabled !== false) {
  const metricsLoop = createMetricsAggregatorLoop({
    root: ROOT,
    intervalMs: config.loops.metricsAggregator?.intervalMs || 60000,
    runnerPool,
    emitAudit,
  });
  loops.push(metricsLoop);
}

// Circuit breaker prober — probes half-open breakers for recovery
if (config.loops.circuitProber?.enabled !== false) {
  const proberLoop = createCircuitProberLoop({
    root: ROOT,
    intervalMs: config.loops.circuitProber?.intervalMs || 15000,
    emitAudit,
  });
  loops.push(proberLoop);
}

// Knowledge loop — indexes completed task outputs into semantic memory
if (config.loops.knowledge?.enabled !== false) {
  const knowledgeLoop = createKnowledgeLoop({
    root: ROOT,
    intervalMs: config.loops.knowledge?.intervalMs || 300000,
    emitAudit,
  });
  loops.push(knowledgeLoop);
}

// ── HTTP API ──
const apiRouter = createApiRouter({ root: ROOT, runnerPool, loops, emitAudit, config, broadcaster });
const server = createServer(apiRouter);

server.listen(config.api.port, config.api.host, () => {
  emitAudit('daemon.api_ready', { port: config.api.port });
  console.log(`[kadima] API on http://${config.api.host}:${config.api.port}`);
  console.log(`[kadima] PID: ${process.pid}`);
  console.log(`[kadima] Loops: ${loops.map(l => l.name).join(', ')}`);
  console.log(`[kadima] Runners: max ${config.runners.maxConcurrent}`);
});

// ── Graceful shutdown ──
async function shutdown(signal) {
  console.log(`[kadima] ${signal} received. Shutting down...`);
  emitAudit('daemon.shutdown', { signal, pid: process.pid });

  for (const loop of loops) loop.stop();
  await runnerPool.drainWithTimeout(10000);
  server.close();

  if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
  console.log('[kadima] Stopped.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
