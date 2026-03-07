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

// ── Phase 1B: Infrastructure modules ──
import { createSystemRuntime } from '../ogu/commands/lib/system-runtime.mjs';
import { createBootstrap } from '../ogu/commands/lib/system-bootstrap.mjs';
import { createShutdownManager } from '../ogu/commands/lib/graceful-shutdown.mjs';
import { createLogger } from '../ogu/commands/lib/logging-framework.mjs';
import { createEventBus } from '../ogu/commands/lib/event-bus.mjs';
import { registerService, removeService } from '../ogu/commands/lib/service-registry.mjs';
import { createHealthAggregator } from '../ogu/commands/lib/health-check-aggregator.mjs';
import { runHealthProbe } from '../ogu/commands/lib/health-probe.mjs';
import { checkSystemHealth } from '../ogu/commands/lib/health-dashboard.mjs';

// ── Phase 2E: Distributed runner & protocol modules ──
import { listRunners, registerRunner, updateRunnerStatus } from '../ogu/commands/lib/distributed-runner.mjs';
import { createRunnerProtocol } from '../ogu/commands/lib/distributed-runner-protocol.mjs';

// ── Phase 3C: Audit Enhancement ──
import { createAuditIndexBuilder } from '../ogu/commands/lib/audit-index-builder.mjs';
import { createAuditRotator } from '../ogu/commands/lib/audit-rotator.mjs';
import { createAuditSealer } from '../ogu/commands/lib/audit-seal.mjs';

// ── Phase 3D: Observability & Trends ──
import { collectSystemMetrics, exportJSON } from '../ogu/commands/lib/telemetry-exporter.mjs';

// ── Phase 4C: Security ──
import { createSecretBroker } from '../ogu/commands/lib/secret-broker.mjs';

// ── Phase 4D: Communication ──
import { createNotifier } from '../ogu/commands/lib/notification-channel.mjs';
import { createNotificationRouter } from '../ogu/commands/lib/notification-router.mjs';
import { createCommand, createResponse, COMMAND_ACTIONS } from '../ogu/commands/lib/ipc-protocol.mjs';

// ── Phase 4F: Command Queue + Batch Processor ──
import { createCommandQueue } from '../ogu/commands/lib/command-queue.mjs';
import { createBatchProcessor } from '../ogu/commands/lib/batch-processor.mjs';
import { getAuditDir, getLogsDir, getOguRoot, getRunnersDir, getStateDir, resolveOguPath, resolveRuntimePath } from '../ogu/commands/lib/runtime-paths.mjs';

// ── Resolve project root ──
const ROOT = process.env.OGU_ROOT || process.cwd();
const OGU_DIR = getOguRoot(ROOT);
const PID_FILE = resolveRuntimePath(ROOT, 'kadima.pid');
const CONFIG_FILE = resolveOguPath(ROOT, 'kadima.config.json');
const LOG_FILE = join(getLogsDir(ROOT), 'kadima.log');

// ── Ensure directories ──
for (const dir of [getLogsDir(ROOT), getRunnersDir(ROOT), getStateDir(ROOT), getAuditDir(ROOT)]) {
  mkdirSync(dir, { recursive: true });
}

// ── Logger (structured, replaces raw console.log) ──
const logger = createLogger({
  level: process.env.OGU_LOG_LEVEL || 'info',
  sink: (entry) => {
    const lvl = (entry.level || 'info').toUpperCase().padEnd(5);
    const data = entry.data && Object.keys(entry.data).length > 0
      ? ' ' + JSON.stringify(entry.data)
      : '';
    console.log(`[kadima] ${lvl} ${entry.message}${data}`);
  },
});

// ── Phase 4C: Secret Broker — load secrets from env with TTL ──
const secretBroker = createSecretBroker();
// Issue secrets from environment into broker with 24h TTL
for (const [key, value] of Object.entries(process.env)) {
  if (/^OGU_SECRET_|^ANTHROPIC_API_KEY$|^OPENAI_API_KEY$/.test(key)) {
    secretBroker.issueSecret(key, value, { ttlMs: 86400000 }); // 24h TTL
  }
}

// ── Central Event Bus ──
const eventBus = createEventBus();

// ── Phase 4D: Notification channel + router ──
const notifier = createNotifier({ root: ROOT, minSeverity: 'info' });
const notificationRouter = createNotificationRouter();
// Default route: all notification types go to console channel via the notifier
notificationRouter.addRoute({
  type: '*',
  channel: 'console',
  handler: ({ type, message, metadata }) => {
    notifier.send({ channel: 'console', severity: metadata?.severity || 'info', title: type, message });
  },
});

// ── Phase 4D: IPC Protocol — structured command/response envelopes ──
// Exposes createCommand/createResponse for use by loops and API handlers
const ipcProtocol = { createCommand, createResponse, COMMAND_ACTIONS };

// ── Phase 4F: Command Queue — undo/redo capable daemon command queue ──
const daemonCommandQueue = createCommandQueue();

// ── Phase 4F: Batch Processor — process audit events in batches ──
const auditBatchProcessor = createBatchProcessor({ batchSize: 50 });

// ── Health Aggregator ──
const healthAggregator = createHealthAggregator();

// ── Shutdown Manager ──
const shutdownManager = createShutdownManager();

// ── System Runtime ──
const systemRuntime = createSystemRuntime();

// ── Bootstrap (dependency-ordered init) ──
const bootstrap = createBootstrap();

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
    api: { host: '127.0.0.1', port: 4210, metricsPort: 4211 },
    runners: { maxConcurrent: 4, spawnMode: 'local', timeoutMs: 600000 },
  };
}

// ── Register subsystems with bootstrap (dependency-ordered) ──
bootstrap.register('eventBus', { init: async () => { logger.info('Event bus ready'); } });
bootstrap.register('healthAggregator', { init: async () => { logger.info('Health aggregator ready'); } });
bootstrap.register('systemRuntime', {
  init: async () => {
    await systemRuntime.boot();
    logger.info('System runtime booted', { subsystems: systemRuntime.getStatus().subsystems });
  },
  deps: ['eventBus', 'healthAggregator'],
});

// Boot all registered subsystems in dependency order
await bootstrap.boot();
logger.info('Bootstrap complete', bootstrap.getStatus());

// ── Audit Index Builder (Phase 3C) ──
const auditIndexBuilder = createAuditIndexBuilder();
logger.info('Audit index builder initialized');

// ── Audit Rotator — daily rotation (Phase 3C) ──
const auditRotator = createAuditRotator({ dir: getAuditDir(ROOT) });
// Trigger rotation on startup for the previous day (best-effort)
{
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  auditRotator.rotate(yesterday).then(result => {
    if (result.rotated) logger.info(`Audit rotated to ${yesterday}.jsonl`, { events: result.events });
  }).catch(() => { /* best-effort */ });
}
// Schedule daily rotation at midnight
{
  const scheduleNextRotation = () => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setUTCHours(24, 0, 0, 0);
    const msUntilMidnight = nextMidnight - now;
    setTimeout(async () => {
      const dateLabel = new Date().toISOString().slice(0, 10);
      const result = await auditRotator.rotate(dateLabel).catch(() => ({ rotated: false }));
      if (result.rotated) logger.info(`Audit rotated to ${dateLabel}.jsonl`, { events: result.events });
      scheduleNextRotation();
    }, msUntilMidnight);
  };
  scheduleNextRotation();
}

// ── Audit Sealer (Phase 3C) ──
const auditSealer = createAuditSealer({ secret: process.env.OGU_AUDIT_SECRET || 'kadima-audit-secret' });

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
  const auditFile = join(getAuditDir(ROOT), 'current.jsonl');
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
notificationRouter.route({ type: 'daemon.start', message: `Kadima daemon started (pid=${process.pid})`, metadata: { severity: 'info' } });

// ── Runner pool ──
const runnerPool = new RunnerPool({
  root: ROOT,
  maxConcurrent: config.runners.maxConcurrent,
  timeoutMs: config.runners.timeoutMs,
  emitAudit,
});

// ── Distributed Runner Protocol & Registry ──
const runnerProtocol = createRunnerProtocol();

// Register the local runner in the distributed runner registry
registerRunner({
  root: ROOT,
  id: `local-${process.pid}`,
  host: config.api.host,
  port: config.api.port,
  capabilities: ['build', 'test', 'lint'],
  maxConcurrency: config.runners.maxConcurrent,
});
logger.info('Local runner registered in distributed registry');

// Health check: distributed runners
healthAggregator.addCheck('distributedRunners', () => {
  const runners = listRunners({ root: ROOT });
  const staleThreshold = Date.now() - 300000; // 5 min
  const stale = runners.filter(r => new Date(r.lastHeartbeat).getTime() < staleThreshold);
  return {
    status: stale.length === 0 ? 'healthy' : 'degraded',
    totalRunners: runners.length,
    staleRunners: stale.length,
  };
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

// ── Register health checks ──
healthAggregator.addCheck('runnerPool', () => {
  const st = runnerPool.status();
  return { status: st.active < st.maxConcurrent ? 'healthy' : 'degraded' };
});
healthAggregator.addCheck('loops', () => {
  const allRunning = loops.every(l => l.isRunning);
  return { status: allRunning ? 'healthy' : 'degraded' };
});
healthAggregator.addCheck('eventBus', () => ({ status: 'healthy' }));
healthAggregator.addCheck('systemRuntime', () => {
  const st = systemRuntime.getStatus();
  return { status: st.state === 'running' ? 'healthy' : 'degraded' };
});

// ── HTTP API ──
const apiRouter = createApiRouter({
  root: ROOT, runnerPool, loops, emitAudit, config, broadcaster,
  healthAggregator, healthProbe: runHealthProbe, healthDashboard: checkSystemHealth,
});
const server = createServer(apiRouter);

server.listen(config.api.port, config.api.host, () => {
  emitAudit('daemon.api_ready', { port: config.api.port });
  logger.info(`API on http://${config.api.host}:${config.api.port}`);
  logger.info(`PID: ${process.pid}`);
  logger.info(`Loops: ${loops.map(l => l.name).join(', ')}`);
  logger.info(`Runners: max ${config.runners.maxConcurrent}`);

  // Telemetry export: collect and log system metrics every 5 minutes (Phase 3D)
  const telemetryIntervalMs = config.telemetry?.intervalMs || 300000;
  const telemetryTimer = setInterval(() => {
    try {
      const metrics = collectSystemMetrics({ root: ROOT });
      const exported = exportJSON(metrics);
      logger.info('Telemetry snapshot', { metricsCount: Object.keys(metrics).length });
      emitAudit('telemetry.snapshot', { metrics, exportedBytes: exported.length });
    } catch { /* best-effort */ }
  }, telemetryIntervalMs);
  // Ensure timer is cleaned up on shutdown
  shutdownManager.register('telemetry', () => {
    clearInterval(telemetryTimer);
    logger.info('Telemetry exporter stopped');
  });

  // Register kadima as a service in the service registry
  registerService({
    root: ROOT,
    id: 'kadima',
    name: 'Kadima Daemon',
    port: config.api.port,
    protocol: 'http',
    healthEndpoint: '/health',
  });
  logger.info('Registered kadima in service registry');
});

// ── Graceful shutdown (via ShutdownManager — LIFO hook execution) ──
shutdownManager.register('loops', () => {
  for (const loop of loops) loop.stop();
  logger.info('All loops stopped');
});
shutdownManager.register('runnerPool', async () => {
  await runnerPool.drainWithTimeout(10000);
  logger.info('Runner pool drained');
});
shutdownManager.register('httpServer', () => {
  server.close();
  logger.info('HTTP server closed');
});
shutdownManager.register('systemRuntime', async () => {
  await systemRuntime.shutdown();
  logger.info('System runtime shut down');
});
shutdownManager.register('serviceDeregister', () => {
  removeService({ root: ROOT, id: 'kadima' });
  logger.info('Deregistered kadima from service registry');
});
shutdownManager.register('auditSeal', () => {
  try {
    // Seal the final shutdown event for integrity
    const shutdownEntry = {
      type: 'daemon.shutdown_final',
      timestamp: new Date().toISOString(),
      pid: process.pid,
    };
    const sealed = auditSealer.seal(shutdownEntry);
    const auditFile = join(getAuditDir(ROOT), 'current.jsonl');
    appendFileSync(auditFile, JSON.stringify({ ...sealed, _type: 'audit_seal' }) + '\n', 'utf8');
    logger.info('Audit file sealed on shutdown');
  } catch { /* best-effort */ }
});
shutdownManager.register('pidFile', () => {
  if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
  logger.info('PID file removed');
});

async function shutdown(signal) {
  logger.info(`${signal} received. Shutting down...`);
  emitAudit('daemon.shutdown', { signal, pid: process.pid });
  await shutdownManager.shutdown();
  logger.info('Stopped.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
