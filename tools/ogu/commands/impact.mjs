import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";

export async function impact() {
  const targetFile = process.argv[3];
  if (!targetFile) {
    console.error("Usage: ogu impact <file>");
    console.error("  Shows what is affected by a change to <file>.");
    return 1;
  }

  const root = repoRoot();
  const graphPath = join(root, ".ogu/GRAPH.json");

  // Auto-build graph if missing or stale
  if (!existsSync(graphPath)) {
    console.log("  Graph not found. Building...");
    const { graph } = await import("./graph.mjs");
    await graph();
    console.log("");
  }

  const graphData = readJsonSafe(graphPath);
  if (!graphData || !graphData.reverse) {
    console.error("  ERROR  Invalid GRAPH.json. Run `ogu graph` to rebuild.");
    return 1;
  }

  // Normalize target path to relative
  const relTarget = targetFile.startsWith("/") ? relative(root, targetFile) : targetFile;

  // Check if file exists in graph
  const allFiles = new Set();
  for (const edge of graphData.edges) {
    allFiles.add(edge.from);
    allFiles.add(edge.to);
  }

  if (!allFiles.has(relTarget)) {
    console.log(`  File "${relTarget}" not found in dependency graph.`);
    console.log(`  Graph contains ${allFiles.size} files. Run \`ogu graph\` to refresh.`);
    return 0;
  }

  // BFS to find all transitive dependents
  const directDeps = graphData.reverse[relTarget] || [];
  const transitiveDeps = new Set();
  const queue = [...directDeps];
  const visited = new Set([relTarget]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    transitiveDeps.add(current);

    const deps = graphData.reverse[current] || [];
    for (const dep of deps) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }

  // Output direct dependents
  console.log(`\n  Impact analysis: ${relTarget}`);
  console.log(`  Graph method: ${graphData.method}`);
  console.log("");

  if (directDeps.length === 0) {
    console.log("  Direct dependents: none");
  } else {
    console.log(`  Direct dependents (${directDeps.length}):`);
    for (const dep of directDeps) {
      const confidence = getEdgeConfidence(graphData, dep, relTarget);
      console.log(`    ${dep}${confidence === "medium" ? " [medium confidence]" : ""}`);
    }
  }

  console.log("");

  // Transitive dependents (excluding direct)
  const transitiveOnly = [...transitiveDeps].filter((d) => !directDeps.includes(d));
  if (transitiveOnly.length === 0) {
    console.log("  Transitive dependents: none beyond direct");
  } else {
    console.log(`  Transitive dependents (${transitiveOnly.length}):`);
    for (const dep of transitiveOnly.slice(0, 20)) {
      console.log(`    ${dep}`);
    }
    if (transitiveOnly.length > 20) {
      console.log(`    ... and ${transitiveOnly.length - 20} more`);
    }
  }

  // Cross-reference with Plan.json tasks
  const affectedTasks = findAffectedTasks(root, relTarget, transitiveDeps);
  if (affectedTasks.length > 0) {
    console.log("");
    console.log(`  Affected Plan.json tasks (${affectedTasks.length}):`);
    for (const task of affectedTasks) {
      console.log(`    ${task.feature}/task-${task.id}: "${task.title}"`);
    }
  }

  // Cross-reference with contract files
  const affectedContracts = findAffectedContracts(root, relTarget, transitiveDeps);
  if (affectedContracts.length > 0) {
    console.log("");
    console.log(`  Affected contracts (${affectedContracts.length}):`);
    for (const c of affectedContracts) {
      console.log(`    ${c}`);
    }
  }

  // Find affected test files
  const affectedTests = [...transitiveDeps, relTarget].filter(
    (f) => f.includes(".test.") || f.includes(".spec.") || f.includes("__tests__")
  );
  if (affectedTests.length > 0) {
    console.log("");
    console.log(`  Affected tests (${affectedTests.length}):`);
    for (const t of affectedTests) {
      console.log(`    ${t}`);
    }
  }

  console.log("");
  console.log(`  Total impact: ${transitiveDeps.size + 1} files (1 changed + ${transitiveDeps.size} dependents)`);

  return 0;
}

// ---------------------------------------------------------------------------

function getEdgeConfidence(graphData, from, to) {
  const edge = graphData.edges.find((e) => e.from === from && e.to === to);
  return edge?.confidence || "unknown";
}

function findAffectedTasks(root, changedFile, affectedFiles) {
  const tasks = [];
  const featuresDir = join(root, "docs/vault/04_Features");
  if (!existsSync(featuresDir)) return tasks;

  const allAffected = new Set([changedFile, ...affectedFiles]);

  try {
    for (const slug of readdirSync(featuresDir)) {
      const planPath = join(featuresDir, slug, "Plan.json");
      const plan = readJsonSafe(planPath);
      if (!plan?.tasks) continue;

      for (const task of plan.tasks) {
        // Check if task touches any affected files
        if (task.touches) {
          for (const touchPattern of task.touches) {
            for (const affected of allAffected) {
              if (affected.startsWith(touchPattern.replace(/\/$/, ""))) {
                tasks.push({ feature: slug, id: task.id, title: task.title });
                break;
              }
            }
            if (tasks.length > 0 && tasks[tasks.length - 1].id === task.id) break;
          }
        }
      }
    }
  } catch { /* skip */ }

  return tasks;
}

function findAffectedContracts(root, changedFile, affectedFiles) {
  const contracts = [];
  const allAffected = new Set([changedFile, ...affectedFiles]);

  // Check if any affected file is in a contract-related path
  for (const file of allAffected) {
    if (file.includes("api") || file.includes("route") || file.includes("endpoint")) {
      if (!contracts.includes("api.contract.json")) contracts.push("api.contract.json");
    }
    if (file.includes("route") || file.includes("navigation") || file.includes("page")) {
      if (!contracts.includes("navigation.contract.json")) contracts.push("navigation.contract.json");
    }
    if (file.includes("theme") || file.includes("token") || file.includes("design")) {
      if (!contracts.includes("design.tokens.json")) contracts.push("design.tokens.json");
    }
  }

  return contracts;
}
