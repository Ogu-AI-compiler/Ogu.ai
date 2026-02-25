import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";

export async function wip() {
  const root = repoRoot();
  const statePath = join(root, ".ogu/STATE.json");
  const state = readJsonSafe(statePath) || {};
  const currentTask = state.current_task || null;

  // Scan all features and their status
  const featuresDir = join(root, "docs/vault/04_Features");
  if (!existsSync(featuresDir)) {
    console.log("  No features directory found.");
    return 0;
  }

  const features = [];
  try {
    for (const slug of readdirSync(featuresDir)) {
      if (slug === "README.md") continue;
      const featureDir = join(featuresDir, slug);

      const hasPrd = existsSync(join(featureDir, "PRD.md"));
      const hasSpec = existsSync(join(featureDir, "Spec.md"));
      const hasPlan = existsSync(join(featureDir, "Plan.json"));
      const hasQa = existsSync(join(featureDir, "QA.md"));
      const hasIdea = existsSync(join(featureDir, "IDEA.md"));

      // Check spec for architect markers
      let specDone = false;
      if (hasSpec) {
        const specContent = readFileSync(join(featureDir, "Spec.md"), "utf-8");
        specDone = !specContent.includes("<!-- TO BE FILLED BY /architect -->");
      }

      // Check plan for tasks
      let planDone = false;
      let taskCount = 0;
      if (hasPlan) {
        const plan = readJsonSafe(join(featureDir, "Plan.json"));
        taskCount = plan?.tasks?.length || 0;
        planDone = taskCount > 0;
      }

      // Check metrics for completion
      const metrics = readJsonSafe(join(root, ".ogu/METRICS.json"));
      const featureMetrics = metrics?.features?.[slug];
      const completed = !!featureMetrics?.completed;

      // Determine phase
      let phase;
      if (completed) {
        phase = "done";
      } else if (planDone && specDone) {
        phase = "ready";  // Ready to build
      } else if (hasPrd && hasSpec && !specDone) {
        phase = "architect"; // Needs /architect
      } else if (hasIdea && !hasPrd) {
        phase = "feature"; // Needs /feature
      } else if (hasIdea || hasPrd) {
        phase = "feature"; // Needs /feature to complete
      } else {
        phase = "idea"; // Needs /idea
      }

      const isCurrent = slug === currentTask;

      features.push({ slug, phase, taskCount, completed, isCurrent });
    }
  } catch { /* skip */ }

  if (features.length === 0) {
    console.log("  No features found.");
    console.log("  Run /idea to start a new feature.");
    return 0;
  }

  // Sort: current first, then by phase progress, then alphabetical
  const phaseOrder = { done: 4, ready: 3, architect: 2, feature: 1, idea: 0 };
  features.sort((a, b) => {
    if (a.isCurrent) return -1;
    if (b.isCurrent) return 1;
    return (phaseOrder[b.phase] || 0) - (phaseOrder[a.phase] || 0) || a.slug.localeCompare(b.slug);
  });

  // Display
  const phaseLabels = {
    idea: "needs /idea",
    feature: "needs /feature",
    architect: "needs /architect",
    ready: "ready to /build",
    done: "COMPLETE",
  };

  console.log(`\n  Work in Progress\n`);

  for (const f of features) {
    const marker = f.isCurrent ? "→" : " ";
    const label = phaseLabels[f.phase] || f.phase;
    const tasks = f.taskCount > 0 ? ` (${f.taskCount} tasks)` : "";
    console.log(`  ${marker} ${f.slug.padEnd(25)} ${label}${tasks}`);
  }

  const active = features.filter((f) => f.phase !== "done");
  const done = features.filter((f) => f.phase === "done");
  console.log(`\n  active   ${active.length}`);
  console.log(`  done     ${done.length}`);
  if (currentTask) {
    console.log(`  current  ${currentTask}`);
  } else {
    console.log(`  current  (none — run ogu switch <slug> to set)`);
  }

  return 0;
}

export async function switchFeature() {
  const slug = process.argv[3];
  if (!slug) {
    console.error("Usage: ogu switch <slug>");
    console.error("  Switch the active feature. Use 'ogu wip' to see all features.");
    return 1;
  }

  const root = repoRoot();
  const featureDir = join(root, `docs/vault/04_Features/${slug}`);

  if (!existsSync(featureDir)) {
    console.error(`  ERROR  Feature "${slug}" not found.`);
    console.error(`  Run: ogu feature:create ${slug}`);
    return 1;
  }

  const statePath = join(root, ".ogu/STATE.json");
  const state = readJsonSafe(statePath) || {};
  const previous = state.current_task;

  // Track feature history
  if (!state.feature_history) state.feature_history = [];
  if (previous && previous !== slug) {
    // Record when we switched away
    state.feature_history.push({
      slug: previous,
      paused_at: new Date().toISOString(),
    });
    // Keep last 20 entries
    state.feature_history = state.feature_history.slice(-20);
  }

  state.current_task = slug;
  state.switched_at = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");

  if (previous && previous !== slug) {
    console.log(`  paused   ${previous}`);
  }
  console.log(`  active   ${slug}`);

  return 0;
}
