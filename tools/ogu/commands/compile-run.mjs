import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { repoRoot } from '../util.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';
import { buildDAG } from './lib/dag-builder.mjs';
import { runGates, checkDrift } from './lib/gate-runner.mjs';
import { getPlanPath } from './lib/plan-loader.mjs';
import { resolveFeatureFile } from './lib/feature-paths.mjs';
import { getCacheDir, getReportsDir, getStateDir } from './lib/runtime-paths.mjs';

/**
 * ogu compile:run <slug> — Full compilation pipeline.
 *
 * Orchestrates: dispatch → build (via Kadima) → verify gates → drift check → report
 *
 * 1. Read Plan.json and Spec.json
 * 2. Dispatch tasks to Kadima (via build:dispatch)
 * 3. Wait for all tasks to complete
 * 4. Run verification gates from Spec.json
 * 5. Check drift
 * 6. Generate compile report
 * 7. Transition feature: building → built → verifying → verified (or failed)
 */
export async function compileRun() {
  const slug = process.argv[3];

  if (!slug) {
    console.error('Usage: ogu compile:run <feature-slug>');
    return 1;
  }

  const root = repoRoot();
  const startTime = Date.now();
  const cli = join(root, 'tools/ogu/cli.mjs');

  emitAudit('compile.start', { featureSlug: slug });
  console.log(`[compile] Starting compilation for "${slug}"`);

  // ── 1. Load Plan.json ──
  const planPath = getPlanPath(slug, root);
  if (!planPath || !existsSync(planPath)) {
    console.error(`[compile] Plan.json not found for "${slug}"`);
    return 1;
  }
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  console.log(`[compile] Plan loaded: ${plan.tasks.length} tasks`);

  // ── 2. Dispatch to Kadima ──
  console.log(`[compile] Dispatching to Kadima...`);
  const dispatchResult = runOgu(cli, root, 'build:dispatch', [slug]);
  if (dispatchResult.exitCode !== 0) {
    console.error(`[compile] Dispatch failed: ${dispatchResult.stderr || dispatchResult.stdout}`);
    return 1;
  }
  console.log(`[compile] ${dispatchResult.stdout.trim()}`);

  // ── 3. Wait for all tasks to complete ──
  console.log(`[compile] Waiting for tasks to complete...`);
  const taskIds = plan.tasks.map(t => t.id);
  const allDone = await waitForTasks(root, taskIds, 30000);

  if (!allDone) {
    console.error(`[compile] Build timed out — not all tasks completed`);
    transitionFeature(cli, root, slug, 'failed');
    return 1;
  }

  const buildDuration = Date.now() - startTime;
  console.log(`[compile] Build complete (${buildDuration}ms)`);

  // ── 4. Transition to verifying ──
  // Feature should auto-transition to "built" via state machine loop
  // Now advance to "verifying"
  await sleep(2000); // Give state machine loop time
  transitionFeature(cli, root, slug, 'verifying');

  // ── 5. Run verification gates ──
  console.log(`[compile] Running verification gates...`);
  const specPath = resolveFeatureFile(root, slug, 'Spec.json');
  let gateResults = [];

  if (existsSync(specPath)) {
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    gateResults = runGates(root, spec.expectations || []);
  }

  const gatesPassed = gateResults.every(g => g.passed);
  console.log(`[compile] Gates: ${gateResults.filter(g => g.passed).length}/${gateResults.length} passed`);

  emitAudit('compile.gates', {
    featureSlug: slug,
    total: gateResults.length,
    passed: gateResults.filter(g => g.passed).length,
    failed: gateResults.filter(g => !g.passed).length,
  });

  // ── 6. Drift check ──
  const drift = checkDrift(gateResults);
  if (drift.drifted) {
    console.log(`[compile] DRIFT DETECTED: ${drift.failedChecks} checks failed`);
    for (const d of drift.details) {
      console.log(`  - ${d}`);
    }
  } else {
    console.log(`[compile] No drift detected`);
  }

  // ── 7. Count completed tasks ──
  const schedulerPath = join(getStateDir(root), 'scheduler-state.json');
  let tasksCompleted = 0;
  if (existsSync(schedulerPath)) {
    const state = JSON.parse(readFileSync(schedulerPath, 'utf8'));
    const featureTasks = state.queue.filter(t => t.featureSlug === slug);
    tasksCompleted = featureTasks.filter(t => t.status === 'completed').length;
  }

  // ── 8. Generate compile report ──
  const totalDuration = Date.now() - startTime;
  const result = gatesPassed && !drift.drifted ? 'PASS' : 'FAIL';

  const report = {
    featureSlug: slug,
    result,
    compiledAt: new Date().toISOString(),
    timing: {
      totalMs: totalDuration,
      buildMs: buildDuration,
      verifyMs: totalDuration - buildDuration,
    },
    tasks: {
      total: plan.tasks.length,
      completed: tasksCompleted,
    },
    gates: gateResults,
    drift,
  };

  const reportsDir = getReportsDir(root);
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    join(reportsDir, `${slug}.compile.json`),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  // ── 9. Generate compile manifest (for incremental builds) ──
  const cacheDir = getCacheDir(root);
  mkdirSync(cacheDir, { recursive: true });
  const manifest = {
    featureSlug: slug,
    compiledAt: new Date().toISOString(),
    result,
    tasks: {},
  };
  for (const task of plan.tasks) {
    // Hash task content for cache comparison
    const taskContent = JSON.stringify(task.output || {});
    const hash = createHash('sha256').update(taskContent).digest('hex').slice(0, 16);
    manifest.tasks[task.id] = {
      hash,
      compiledAt: new Date().toISOString(),
      files: (task.output?.files || []).map(f => f.path),
    };
  }
  writeFileSync(
    join(cacheDir, `${slug}.manifest.json`),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  // ── 10. Final transition ──
  if (result === 'PASS') {
    transitionFeature(cli, root, slug, 'verified');
    console.log(`[compile] ✓ PASS — "${slug}" compiled and verified`);
  } else {
    transitionFeature(cli, root, slug, 'failed');
    console.log(`[compile] ✗ FAIL — "${slug}" has gate failures or drift`);
  }

  emitAudit('compile.complete', {
    featureSlug: slug,
    result,
    gatesPassed: gateResults.filter(g => g.passed).length,
    gatesFailed: gateResults.filter(g => !g.passed).length,
    drifted: drift.drifted,
    durationMs: totalDuration,
  });

  return result === 'PASS' ? 0 : 1;
}

// ── Helpers ──

function runOgu(cli, root, command, args = []) {
  try {
    const output = execFileSync('node', [cli, command, ...args], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, OGU_ROOT: root, NODE_NO_WARNINGS: '1' },
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
    };
  }
}

function transitionFeature(cli, root, slug, targetState) {
  try {
    execFileSync('node', [cli, 'feature:state', slug, targetState], {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, OGU_ROOT: root, NODE_NO_WARNINGS: '1' },
    });
  } catch { /* may fail if transition is invalid — that's ok */ }
}

async function waitForTasks(root, taskIds, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const statePath = join(root, '.ogu/state/scheduler-state.json');
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, 'utf8'));
      const allComplete = taskIds.every(id => {
        const task = state.queue.find(t => t.taskId === id);
        return task && task.status === 'completed';
      });
      if (allComplete) return true;
    }
    await sleep(500);
  }
  return false;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
