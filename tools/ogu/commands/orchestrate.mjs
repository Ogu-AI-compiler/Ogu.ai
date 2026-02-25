import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { repoRoot, readJsonSafe } from "../util.mjs";

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

  // Check if parallel execution is possible (need touches fields)
  const hasTouches = plan.tasks.some((t) => t.touches && t.touches.length > 0);
  if (!hasTouches) {
    console.log("  warn     No 'touches' fields in tasks. Parallel execution disabled.");
    console.log("  hint     Add 'touches' to Plan.json tasks to enable parallel execution.");
  }

  // Build DAG using Kahn's algorithm
  const waves = buildWaves(plan.tasks, taskMap);

  // Detect scope conflicts within waves
  const conflicts = detectScopeConflicts(waves, taskMap);

  // Resolve conflicts by pushing overlapping tasks to later waves
  const resolvedWaves = resolveConflicts(waves, conflicts, taskMap);

  // Find critical path
  const criticalPath = findCriticalPath(plan.tasks, taskMap);

  // Compute max parallelism
  const maxParallelism = Math.max(...resolvedWaves.map((w) => w.tasks.length));

  // Run post-wave validation if --validate flag
  const postWaveValidation = args.includes("--validate")
    ? validatePostWave(root, resolvedWaves.length)
    : null;

  const dag = {
    feature: slug,
    waves: resolvedWaves,
    critical_path: criticalPath,
    max_parallelism: maxParallelism,
    scope_conflicts: conflicts,
    total_tasks: plan.tasks.length,
    parallelizable: hasTouches,
    post_wave_validation: postWaveValidation,
  };

  // Write output
  const outDir = join(root, `.ogu/orchestrate/${slug}`);
  mkdirSync(outDir, { recursive: true });

  const dagPath = join(outDir, "PLAN_DAG.json");
  writeFileSync(dagPath, JSON.stringify(dag, null, 2) + "\n", "utf-8");

  // Report
  console.log(`\n  Orchestration: ${slug}`);
  console.log(`  Tasks: ${plan.tasks.length}`);
  console.log(`  Waves: ${resolvedWaves.length}`);
  console.log(`  Max parallel: ${maxParallelism}`);
  console.log(`  Conflicts: ${conflicts.length}`);

  for (const wave of resolvedWaves) {
    const taskNames = wave.tasks.map((id) => {
      const t = taskMap.get(id);
      return `${id}:${t.title?.slice(0, 25) || "?"}`;
    });
    const parallel = wave.parallel ? "parallel" : "sequential";
    console.log(`  wave ${wave.wave}: [${taskNames.join(", ")}] (${parallel})`);
  }

  if (criticalPath.length > 0) {
    console.log(`  critical path: ${criticalPath.join(" → ")}`);
  }

  console.log(`  dag      .ogu/orchestrate/${slug}/PLAN_DAG.json`);
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
