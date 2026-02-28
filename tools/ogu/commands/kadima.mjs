import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { repoRoot } from '../util.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';

/**
 * ogu kadima:start   — Start the Kadima daemon
 * ogu kadima:stop    — Stop the Kadima daemon
 * ogu kadima:status  — Show daemon status
 * ogu kadima:enqueue — Add task to scheduler queue
 */

const DAEMON_PATH = join(import.meta.dirname, '../../kadima/daemon.mjs');
const PID_FILE = () => join(repoRoot(), '.ogu/kadima.pid');

function isDaemonRunning() {
  const pidFile = PID_FILE();
  if (!existsSync(pidFile)) return false;

  const pid = parseInt(readFileSync(pidFile, 'utf8').trim());
  try {
    process.kill(pid, 0); // Signal 0 = check if alive
    return pid;
  } catch {
    // PID file exists but process is dead — clean up
    unlinkSync(pidFile);
    return false;
  }
}

async function pollHealth(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/health`);
      if (resp.ok) return true;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

// ── kadima:start ──

export async function kadimaStart() {
  const pid = isDaemonRunning();
  if (pid) {
    console.log(`Kadima already running (PID: ${pid})`);
    return 1;
  }

  const root = repoRoot();

  // Load config for port
  let port = 4200;
  const configPath = join(root, '.ogu/kadima.config.json');
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    port = config.api?.port || 4200;
  }

  // Ensure log directory
  mkdirSync(join(root, '.ogu/logs'), { recursive: true });

  // Spawn daemon as detached process
  const child = spawn('node', [DAEMON_PATH], {
    cwd: root,
    detached: true,
    env: { ...process.env, OGU_ROOT: root },
    stdio: 'ignore',
  });

  child.unref();

  // Wait for health check
  const healthy = await pollHealth(port, 10000);
  if (!healthy) {
    console.error('Kadima failed to start within 10s');
    return 1;
  }

  const newPid = isDaemonRunning();
  console.log(`Kadima running (PID: ${newPid})`);
  console.log(`  API: http://127.0.0.1:${port}`);
  return 0;
}

// ── kadima:stop ──

export async function kadimaStop() {
  const pid = isDaemonRunning();
  if (!pid) {
    console.log('Kadima is not running.');
    return 0;
  }

  process.kill(pid, 'SIGTERM');

  // Wait for PID file to disappear (graceful shutdown)
  const start = Date.now();
  while (Date.now() - start < 10000) {
    if (!existsSync(PID_FILE())) {
      console.log(`Kadima stopped (was PID: ${pid})`);
      return 0;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Force kill if still running
  try {
    process.kill(pid, 'SIGKILL');
  } catch { /* already dead */ }
  if (existsSync(PID_FILE())) unlinkSync(PID_FILE());
  console.log(`Kadima force-stopped (PID: ${pid})`);
  return 0;
}

// ── kadima:status ──

export async function kadimaStatus() {
  const pid = isDaemonRunning();
  if (!pid) {
    console.log('Kadima is not running.');
    return 1;
  }

  // Load config for port
  const root = repoRoot();
  let port = 4200;
  const configPath = join(root, '.ogu/kadima.config.json');
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    port = config.api?.port || 4200;
  }

  try {
    const resp = await fetch(`http://127.0.0.1:${port}/health`);
    if (resp.ok) {
      const health = await resp.json();
      console.log(`HEALTHY (PID: ${health.pid})`);
      console.log(`  Uptime: ${Math.round(health.uptime)}s`);
      console.log(`  Loops:`);
      for (const loop of health.loops || []) {
        console.log(`    ${loop.name}: ${loop.running ? 'running' : 'stopped'} (${loop.tickCount} ticks)`);
      }
      console.log(`  Runners: ${health.runners?.active || 0}/${health.runners?.maxConcurrent || 0} active`);
      return 0;
    }
  } catch {
    console.log(`Kadima running (PID: ${pid}) but health check failed.`);
    return 1;
  }
}

// ── kadima:enqueue ──

export async function kadimaEnqueue() {
  const args = process.argv.slice(3);
  let feature = null, task = null, dryRun = false, blockedByStr = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && args[i + 1]) feature = args[++i];
    else if (args[i] === '--task' && args[i + 1]) task = args[++i];
    else if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--blocked-by' && args[i + 1]) blockedByStr = args[++i];
  }

  if (!feature || !task) {
    console.error('Usage: ogu kadima:enqueue --feature <slug> --task <taskId> [--dry-run] [--blocked-by a,b]');
    return 1;
  }

  const blockedBy = blockedByStr ? blockedByStr.split(',').map(s => s.trim()) : [];

  const root = repoRoot();
  const statePath = join(root, '.ogu/state/scheduler-state.json');
  mkdirSync(join(root, '.ogu/state'), { recursive: true });

  let state;
  if (existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, 'utf8'));
  } else {
    state = { version: 1, queue: [], updatedAt: new Date().toISOString() };
  }

  // Check for duplicate
  if (state.queue.find(t => t.taskId === task)) {
    console.log(`Task "${task}" already in queue.`);
    return 0;
  }

  state.queue.push({
    taskId: task,
    featureSlug: feature,
    status: 'pending',
    dryRun,
    enqueuedAt: new Date().toISOString(),
    blockedBy,
  });

  // Also register task on the feature state file (for auto-transition)
  const featureStatePath = join(root, `.ogu/state/features/${feature}.state.json`);
  if (existsSync(featureStatePath)) {
    const featureState = JSON.parse(readFileSync(featureStatePath, 'utf8'));
    if (!featureState.tasks) featureState.tasks = [];
    if (!featureState.tasks.find(t => t.taskId === task)) {
      featureState.tasks.push({ taskId: task, status: 'pending' });
      featureState.updatedAt = new Date().toISOString();
      writeFileSync(featureStatePath, JSON.stringify(featureState, null, 2), 'utf8');
    }
  }

  state.updatedAt = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

  emitAudit('scheduler.task_enqueued', {
    taskId: task,
    featureSlug: feature,
    dryRun,
    blockedBy,
  }, {
    feature: { slug: feature, taskId: task },
  });

  console.log(`Enqueued: ${task} (feature: ${feature}${dryRun ? ', dry-run' : ''})`);
  return 0;
}
