import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { repoRoot, readJsonSafe } from "../util.mjs";
import { normalizeIR, normalizeRouteForConflict } from "./lib/normalize-ir.mjs";
import { createDAGRunner } from "./lib/dag-runner.mjs";
import { createWaveExecutor } from "./lib/wave-executor.mjs";
import { createCompleteWaveExecutor } from "./lib/wave-executor-complete.mjs";
import { detectConflicts } from "./lib/wave-conflict-detector.mjs";
import { createPipelineOrchestrator } from "./lib/pipeline-orchestrator.mjs";
import { createPhaseCoordinator } from "./lib/phase-coordinator.mjs";
import { detectPhase, isPhaseAfter, PHASE_ORDER } from "./lib/phase-detector.mjs";
import { topoSort, findCriticalPath as findCriticalPathWeighted, getExecutionWaves } from "./lib/task-dep-resolver.mjs";
import { splitTask, mergeResults } from "./lib/task-splitter.mjs";
import { createCheckpoint, loadCheckpoint, updateCheckpoint, listCheckpoints, clearCheckpoint } from "./lib/task-checkpoint.mjs";
import { createLockCoordinator } from "./lib/lock-coordinator.mjs";
import { createContentionResolver, RESOLUTION_STRATEGIES } from "./lib/contention-resolver.mjs";

export async function orchestrate() {
  const args = process.argv.slice(3);
  const slug = args.find((a) => !a.startsWith("--"));
  if (!slug) {
    console.error("Usage: ogu orchestrate <slug> [--validate]");
    console.error("  Builds a DAG from Plan.json and computes parallel execution waves.");
    return 1;
  }

  const root = repoRoot();
  const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);

  const plan = readJsonSafe(planPath);
  if (!plan) {
    console.error(`  ERROR  Plan.json not found or invalid: docs/vault/04_Features/${slug}/Plan.json`);
    return 1;
  }

  if (!plan.tasks || plan.tasks.length === 0) {
    console.error("  ERROR  Plan.json has no tasks.");
    return 1;
  }

  // Validate task structure
  const taskMap = new Map();
  for (const task of plan.tasks) {
    if (!task.id) {
      console.error(`  ERROR  Task missing id: ${JSON.stringify(task)}`);
      return 1;
    }
    taskMap.set(task.id, task);
  }

  // Validate dependencies exist
  for (const task of plan.tasks) {
    for (const dep of (task.depends_on || [])) {
      if (!taskMap.has(dep)) {
        console.error(`  ERROR  Task ${task.id} depends on unknown task ${dep}`);
        return 1;
      }
    }
  }

  // Detect current phase for context
  const phaseInfo = detectPhase({ root });
  const isExecuteMode = args.includes("--execute");
  const isResumeMode = args.includes("--resume");
  const useEnhanced = args.includes("--enhanced");
  const maxSubtaskSize = parseInt(args.find((a) => a.startsWith("--max-subtask="))?.split("=")[1] || "0", 10);

  // Check if parallel execution is possible (need touches fields)
  const hasTouches = plan.tasks.some((t) => t.touches && t.touches.length > 0);
  if (!hasTouches) {
    console.log("  warn     No 'touches' fields in tasks. Parallel execution disabled.");
    console.log("  hint     Add 'touches' to Plan.json tasks to enable parallel execution.");
  }

  // Use task-dep-resolver for topological sort validation
  const depTasks = plan.tasks.map((t) => ({
    id: t.id,
    deps: t.depends_on || [],
    duration: t.estimated_hours || 1,
  }));

  try {
    topoSort(depTasks);
  } catch (err) {
    console.error(`  ERROR  ${err.message}`);
    return 1;
  }

  // Split oversized tasks if --max-subtask is set
  let effectiveTasks = plan.tasks;
  const splitMap = new Map(); // parentId → subtask[]
  if (maxSubtaskSize > 0) {
    const expanded = [];
    for (const task of plan.tasks) {
      const items = task.subtasks || task.steps || [];
      if (items.length > maxSubtaskSize) {
        const subtasks = splitTask({ id: task.id, items, maxPerSubtask: maxSubtaskSize });
        splitMap.set(task.id, subtasks);
        for (const sub of subtasks) {
          expanded.push({
            ...task,
            id: `${task.id}.${sub.index}`,
            title: `${task.title || task.id} [part ${sub.index + 1}]`,
            depends_on: sub.index === 0 ? (task.depends_on || []) : [`${task.id}.${sub.index - 1}`],
          });
          taskMap.set(`${task.id}.${sub.index}`, expanded[expanded.length - 1]);
        }
      } else {
        expanded.push(task);
      }
    }
    effectiveTasks = expanded;
    if (splitMap.size > 0) {
      console.log(`  split    ${splitMap.size} task(s) into subtasks (max ${maxSubtaskSize} items each)`);
    }
  }

  // Build DAG using Kahn's algorithm
  const waves = buildWaves(effectiveTasks, taskMap);

  // Detect scope conflicts (file overlap) within waves
  const conflicts = detectScopeConflicts(waves, taskMap);

  // Also use wave-conflict-detector for semantic file-level conflict detection
  for (const wave of waves) {
    if (wave.tasks.length < 2) continue;
    const agents = wave.tasks.map((id) => {
      const t = taskMap.get(id);
      return { id, files: t.touches || [] };
    });
    const waveConflicts = detectConflicts({ agents });
    if (waveConflicts.hasConflicts) {
      for (const c of waveConflicts.conflicts) {
        // Avoid duplicates — only add if not already covered by scope detection
        const exists = conflicts.some(
          (ex) => ex.wave === wave.wave && ex.overlap?.includes(c.file)
        );
        if (!exists) {
          conflicts.push({
            tasks: c.agents,
            wave: wave.wave,
            overlap: [c.file],
            resolution: "sequential",
            source: "wave-conflict-detector",
          });
        }
      }
    }
  }

  // Detect resource conflicts within waves
  const resourceConflicts = detectResourceConflicts(waves, taskMap);
  conflicts.push(...resourceConflicts);

  // Use lock-coordinator and contention-resolver for conflict resolution
  const lockCoord = createLockCoordinator();
  const contentionResolver = createContentionResolver();

  // Register detected conflicts in contention resolver
  for (const conflict of conflicts) {
    if (conflict.tasks.length >= 2) {
      const resource = conflict.overlap?.[0] || conflict.resource || "unknown";
      contentionResolver.reportConflict({
        resource,
        agents: conflict.tasks,
        type: conflict.resource ? "resource" : "write-write",
      });
    }
  }

  // Resolve conflicts by pushing overlapping tasks to later waves
  const resolvedWaves = resolveConflicts(waves, conflicts, taskMap);

  // Find critical path — use weighted version from task-dep-resolver when durations available
  const hasDurations = effectiveTasks.some((t) => t.estimated_hours || t.duration);
  let criticalPath;
  let criticalPathDuration = 0;
  if (hasDurations) {
    const weighted = findCriticalPathWeighted(depTasks);
    criticalPath = weighted.path;
    criticalPathDuration = weighted.totalDuration;
  } else {
    criticalPath = findCriticalPath(effectiveTasks, taskMap);
  }

  // Compute max parallelism
  const maxParallelism = Math.max(...resolvedWaves.map((w) => w.tasks.length));

  // Run post-wave validation if --validate flag
  const postWaveValidation = args.includes("--validate")
    ? validatePostWave(root, resolvedWaves.length)
    : null;

  // Load existing checkpoints for resume support
  const existingCheckpoints = isResumeMode ? listCheckpoints({ root }) : [];
  const completedTaskIds = new Set(
    existingCheckpoints
      .filter((cp) => cp.featureSlug === slug && cp.progress >= 100)
      .map((cp) => cp.taskId)
  );

  // Build execution waves from task-dep-resolver for comparison/validation
  const resolverWaves = getExecutionWaves(depTasks);

  // Get contention report
  const contentionReport = contentionResolver.listConflicts();

  const dag = {
    feature: slug,
    phase: phaseInfo.current,
    waves: resolvedWaves,
    resolver_waves: resolverWaves,
    critical_path: criticalPath,
    critical_path_duration: criticalPathDuration || undefined,
    max_parallelism: maxParallelism,
    scope_conflicts: conflicts.filter((c) => !c.resource),
    resource_conflicts: conflicts.filter((c) => c.resource),
    contention_report: contentionReport.length > 0 ? contentionReport : undefined,
    split_tasks: splitMap.size > 0 ? Object.fromEntries(
      [...splitMap.entries()].map(([k, v]) => [k, v.length])
    ) : undefined,
    total_tasks: effectiveTasks.length,
    original_tasks: plan.tasks.length,
    parallelizable: hasTouches,
    post_wave_validation: postWaveValidation,
    resumed_from: completedTaskIds.size > 0 ? [...completedTaskIds] : undefined,
  };

  // Write output
  const outDir = join(root, `.ogu/orchestrate/${slug}`);
  mkdirSync(outDir, { recursive: true });

  const dagPath = join(outDir, "PLAN_DAG.json");
  writeFileSync(dagPath, JSON.stringify(dag, null, 2) + "\n", "utf-8");

  // Report
  console.log(`\n  Orchestration: ${slug}`);
  console.log(`  Phase: ${phaseInfo.current}${phaseInfo.feature ? ` (feature: ${phaseInfo.feature})` : ""}`);
  console.log(`  Tasks: ${effectiveTasks.length}${splitMap.size > 0 ? ` (${plan.tasks.length} original, ${splitMap.size} split)` : ""}`);
  console.log(`  Waves: ${resolvedWaves.length}`);
  console.log(`  Max parallel: ${maxParallelism}`);
  console.log(`  Conflicts: ${conflicts.length}${contentionReport.length > 0 ? ` (${contentionReport.length} contention records)` : ""}`);
  if (completedTaskIds.size > 0) {
    console.log(`  Resumed: ${completedTaskIds.size} task(s) already checkpointed`);
  }

  for (const wave of resolvedWaves) {
    const taskNames = wave.tasks.map((id) => {
      const t = taskMap.get(id);
      return `${id}:${t.title?.slice(0, 25) || "?"}`;
    });
    const parallel = wave.parallel ? "parallel" : "sequential";
    console.log(`  wave ${wave.wave}: [${taskNames.join(", ")}] (${parallel})`);
  }

  if (criticalPath.length > 0) {
    console.log(`  critical path: ${criticalPath.join(" → ")}${criticalPathDuration ? ` (${criticalPathDuration}h)` : ""}`);
  }

  console.log(`  dag      .ogu/orchestrate/${slug}/PLAN_DAG.json`);

  // --execute: actually run the DAG using dag-runner + wave execution
  if (isExecuteMode) {
    console.log(`\n  Executing DAG...`);

    // Set up phase coordinator for phase transition gates
    const phaseCoord = createPhaseCoordinator();
    phaseCoord.registerTransition("architect", "build", {
      gate: "plan-ready",
      check: () => existsSync(planPath),
    });
    phaseCoord.registerTransition("build", "verify-ui", {
      gate: "build-complete",
      check: () => true,
    });

    // Phase gate check: must be at or past 'build' phase to execute
    if (isPhaseAfter("build", phaseInfo.current) && phaseInfo.current !== "build") {
      console.log(`  warn     Current phase '${phaseInfo.current}' is before 'build'. Execution may be premature.`);
    }

    // Choose executor: enhanced (with conflict detection) or standard
    if (useEnhanced) {
      const completeExecutor = createCompleteWaveExecutor();
      for (const wave of resolvedWaves) {
        const waveTasks = wave.tasks
          .filter((id) => !completedTaskIds.has(id))
          .map((id) => {
            const t = taskMap.get(id);
            return {
              id,
              files: t.touches || [],
              run: async () => {
                createCheckpoint({ root, taskId: id, featureSlug: slug, progress: 0 });

                // Acquire locks for touched files
                for (const file of (t.touches || [])) {
                  const lockResult = lockCoord.acquire(file, id);
                  if (!lockResult.acquired) {
                    throw new Error(`Lock contention on ${file} (held by ${lockResult.heldBy})`);
                  }
                }

                try {
                  // Task execution placeholder — actual work handled by agent-executor
                  updateCheckpoint({ root, taskId: id, progress: 100, state: { status: "completed" } });
                  return { taskId: id, status: "completed" };
                } finally {
                  for (const file of (t.touches || [])) {
                    lockCoord.release(file, id);
                  }
                }
              },
            };
          });

        if (waveTasks.length > 0) {
          const waveResult = await completeExecutor.executeWave({ tasks: waveTasks });
          console.log(`  wave ${wave.wave}: ${waveResult.completed.length} completed, ${waveResult.failed.length} failed, ${waveResult.conflicts.length} conflicts`);

          if (waveResult.failed.length > 0) {
            console.error(`  ERROR  Wave ${wave.wave} had failures: ${waveResult.failed.map((f) => f.id).join(", ")}`);
            break;
          }
        }
      }

      // Write execution results
      const execResults = completeExecutor.getResults();
      writeFileSync(
        join(outDir, "EXECUTION_LOG.json"),
        JSON.stringify(execResults, null, 2) + "\n",
        "utf-8"
      );
      console.log(`  exec     .ogu/orchestrate/${slug}/EXECUTION_LOG.json`);
    } else {
      // Standard DAG runner
      const runner = createDAGRunner();
      const runnerTasks = effectiveTasks
        .filter((t) => !completedTaskIds.has(t.id))
        .map((t) => ({
          id: t.id,
          deps: (t.depends_on || []).filter((d) => !completedTaskIds.has(d)),
          run: async () => {
            createCheckpoint({ root, taskId: t.id, featureSlug: slug, progress: 0 });
            updateCheckpoint({ root, taskId: t.id, progress: 100, state: { status: "completed" } });
            return { taskId: t.id, status: "completed" };
          },
        }));

      runner.loadPlan({ tasks: runnerTasks });
      const result = await runner.run();

      console.log(`  DAG execution: ${result.state}`);
      console.log(`  completed: ${result.completed.length}, failed: ${result.failed.length}, skipped: ${result.skipped.length}`);

      writeFileSync(
        join(outDir, "EXECUTION_LOG.json"),
        JSON.stringify(result, null, 2) + "\n",
        "utf-8"
      );
      console.log(`  exec     .ogu/orchestrate/${slug}/EXECUTION_LOG.json`);
    }

    // Write lock state
    const lockState = lockCoord.listLocks();
    if (lockState.length > 0) {
      writeFileSync(
        join(outDir, "LOCK_STATE.json"),
        JSON.stringify(lockState, null, 2) + "\n",
        "utf-8"
      );
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------

function buildWaves(tasks, taskMap) {
  // Kahn's algorithm — BFS topological sort grouping by level
  const inDegree = new Map();
  const dependents = new Map();

  for (const task of tasks) {
    inDegree.set(task.id, (task.depends_on || []).length);
    dependents.set(task.id, []);
  }

  for (const task of tasks) {
    for (const dep of (task.depends_on || [])) {
      dependents.get(dep).push(task.id);
    }
  }

  const waves = [];
  let ready = tasks.filter((t) => inDegree.get(t.id) === 0).map((t) => t.id);
  let waveNum = 1;

  while (ready.length > 0) {
    waves.push({
      wave: waveNum,
      tasks: [...ready],
      parallel: ready.length > 1,
    });

    const nextReady = [];
    for (const taskId of ready) {
      for (const depId of dependents.get(taskId)) {
        inDegree.set(depId, inDegree.get(depId) - 1);
        if (inDegree.get(depId) === 0) {
          nextReady.push(depId);
        }
      }
    }

    ready = nextReady;
    waveNum++;
  }

  // Check for cycles
  const scheduled = new Set(waves.flatMap((w) => w.tasks));
  if (scheduled.size < tasks.length) {
    const unscheduled = tasks.filter((t) => !scheduled.has(t.id)).map((t) => t.id);
    console.error(`  ERROR  Dependency cycle detected involving tasks: ${unscheduled.join(", ")}`);
  }

  return waves;
}

function detectScopeConflicts(waves, taskMap) {
  const conflicts = [];

  for (const wave of waves) {
    if (wave.tasks.length < 2) continue;

    for (let i = 0; i < wave.tasks.length; i++) {
      for (let j = i + 1; j < wave.tasks.length; j++) {
        const taskA = taskMap.get(wave.tasks[i]);
        const taskB = taskMap.get(wave.tasks[j]);
        const touchesA = taskA.touches || [];
        const touchesB = taskB.touches || [];

        if (touchesA.length === 0 || touchesB.length === 0) continue;

        const overlap = findOverlap(touchesA, touchesB);
        if (overlap.length > 0) {
          conflicts.push({
            tasks: [wave.tasks[i], wave.tasks[j]],
            wave: wave.wave,
            overlap,
            resolution: "sequential",
          });
        }
      }
    }
  }

  return conflicts;
}

function detectResourceConflicts(waves, taskMap) {
  const conflicts = [];

  for (const wave of waves) {
    if (wave.tasks.length < 2) continue;

    for (let i = 0; i < wave.tasks.length; i++) {
      for (let j = i + 1; j < wave.tasks.length; j++) {
        const taskA = taskMap.get(wave.tasks[i]);
        const taskB = taskMap.get(wave.tasks[j]);
        const resourcesA = (taskA.resources || []).map(normalizeIR);
        const resourcesB = (taskB.resources || []).map(normalizeIR);

        if (resourcesA.length === 0 || resourcesB.length === 0) continue;

        const overlap = findResourceOverlap(resourcesA, resourcesB);
        if (overlap.length > 0) {
          conflicts.push({
            tasks: [wave.tasks[i], wave.tasks[j]],
            wave: wave.wave,
            resource: overlap[0],
            overlap,
            resolution: "sequential",
          });
        }
      }
    }
  }

  return conflicts;
}

function findResourceOverlap(resourcesA, resourcesB) {
  const overlaps = [];
  for (const a of resourcesA) {
    for (const b of resourcesB) {
      // Exact match
      if (a === b) {
        overlaps.push(a);
        continue;
      }
      // Wildcard: CONTRACT:* conflicts with any CONTRACT:*
      const [typeA] = a.split(":");
      const [typeB] = b.split(":");
      if (typeA === typeB && (a.endsWith(":*") || b.endsWith(":*"))) {
        overlaps.push(a.endsWith(":*") ? a : b);
        continue;
      }
      // Prefix match for routes: ROUTE:/users conflicts with ROUTE:/users/:id
      if (typeA === "ROUTE" && typeB === "ROUTE") {
        const normA = normalizeRouteForConflict(a);
        const normB = normalizeRouteForConflict(b);
        if (normA === normB || normA.startsWith(normB) || normB.startsWith(normA)) {
          overlaps.push(`${a} <> ${b}`);
        }
      }
    }
  }
  return [...new Set(overlaps)];
}

function findOverlap(touchesA, touchesB) {
  const overlaps = [];
  for (const a of touchesA) {
    for (const b of touchesB) {
      const normA = a.replace(/\/$/, "");
      const normB = b.replace(/\/$/, "");
      // One is prefix of the other, or they're the same
      if (normA.startsWith(normB) || normB.startsWith(normA) || normA === normB) {
        overlaps.push(normA.length <= normB.length ? normA : normB);
      }
    }
  }
  return [...new Set(overlaps)];
}

function resolveConflicts(waves, conflicts, taskMap) {
  if (conflicts.length === 0) return waves;

  // Clone waves
  const resolved = waves.map((w) => ({ ...w, tasks: [...w.tasks] }));

  for (const conflict of conflicts) {
    // Move the second task to the next wave
    const taskToMove = conflict.tasks[1];
    const sourceWave = resolved.find((w) => w.tasks.includes(taskToMove));
    if (!sourceWave) continue;

    // Remove from source wave
    sourceWave.tasks = sourceWave.tasks.filter((id) => id !== taskToMove);

    // Find or create next wave
    let nextWave = resolved.find((w) => w.wave === sourceWave.wave + 1);
    if (!nextWave) {
      nextWave = { wave: sourceWave.wave + 1, tasks: [], parallel: false };
      resolved.push(nextWave);
      resolved.sort((a, b) => a.wave - b.wave);
    }

    nextWave.tasks.push(taskToMove);
  }

  // Update parallel flags
  for (const wave of resolved) {
    wave.parallel = wave.tasks.length > 1;
  }

  // Remove empty waves
  return resolved.filter((w) => w.tasks.length > 0);
}

export function validatePostWave(root, waveNum) {
  const results = { wave: waveNum, checks: [], passed: true };

  // TypeScript check
  const tsConfigPath = join(root, "tsconfig.json");
  if (existsSync(tsConfigPath)) {
    try {
      execSync("npx tsc --noEmit", { cwd: root, stdio: "pipe", timeout: 60000 });
      results.checks.push({ name: "typecheck", status: "passed" });
    } catch (err) {
      const output = err.stdout?.toString() || err.stderr?.toString() || "unknown error";
      results.checks.push({ name: "typecheck", status: "failed", error: output.slice(0, 500) });
      results.passed = false;
    }
  }

  // Build check
  const pkgPath = join(root, "package.json");
  const pkg = readJsonSafe(pkgPath);
  if (pkg?.scripts?.build) {
    try {
      execSync("npm run build", { cwd: root, stdio: "pipe", timeout: 120000 });
      results.checks.push({ name: "build", status: "passed" });
    } catch (err) {
      const output = err.stdout?.toString() || err.stderr?.toString() || "unknown error";
      results.checks.push({ name: "build", status: "failed", error: output.slice(0, 500) });
      results.passed = false;
    }
  }

  if (results.checks.length === 0) {
    results.checks.push({ name: "none", status: "skipped", note: "no tsconfig.json or build script found" });
  }

  return results;
}

function findCriticalPath(tasks, taskMap) {
  // Find the longest path through the DAG
  const memo = new Map();

  function longestPath(taskId) {
    if (memo.has(taskId)) return memo.get(taskId);

    const task = taskMap.get(taskId);
    const deps = task.depends_on || [];

    if (deps.length === 0) {
      memo.set(taskId, [taskId]);
      return [taskId];
    }

    let longest = [];
    for (const dep of deps) {
      const path = longestPath(dep);
      if (path.length > longest.length) {
        longest = path;
      }
    }

    const result = [...longest, taskId];
    memo.set(taskId, result);
    return result;
  }

  let criticalPath = [];
  for (const task of tasks) {
    const path = longestPath(task.id);
    if (path.length > criticalPath.length) {
      criticalPath = path;
    }
  }

  return criticalPath;
}
