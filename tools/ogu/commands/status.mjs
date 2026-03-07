import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";

// ── Phase 4B: Time Travel & Snapshots ──
import { createTimeTravelEngine } from "./lib/time-travel-engine.mjs";
import { listSnapshots } from "./lib/time-travel.mjs";
import { createSnapshotVersioner } from "./lib/snapshot-versioner.mjs";

// Shared time-travel and snapshot instances for status display
const _timeTravelEngine = createTimeTravelEngine();
const _snapshotVersioner = createSnapshotVersioner();

export async function status() {
  const root = repoRoot();
  const projectName = basename(root);

  console.log(`\n  Ogu Status Dashboard — ${projectName}`);
  console.log("  " + "─".repeat(50));

  // 1. Project profile
  const profile = readJsonSafe(join(root, ".ogu/PROFILE.json"));
  if (profile) {
    console.log(`\n  Platform   ${profile.platform || "unknown"}`);
    console.log(`  Services   ${(profile.services || []).join(", ") || "none detected"}`);
  } else {
    console.log(`\n  Platform   Not profiled (run: ogu profile)`);
  }

  // 2. Current feature
  const state = readJsonSafe(join(root, ".ogu/STATE.json"));
  const currentTask = state?.current_task;
  if (currentTask) {
    console.log(`\n  Active     ${currentTask}`);
    const phase = detectPhase(root, currentTask);
    console.log(`  Phase      ${phase}`);
  } else {
    console.log(`\n  Active     None (run: ogu switch <slug>)`);
  }

  // 3. Gate state (if active feature)
  if (currentTask) {
    const gateState = readJsonSafe(join(root, ".ogu/GATE_STATE.json"));
    if (gateState?.feature === currentTask && gateState?.gates) {
      const entries = Object.entries(gateState.gates);
      const passed = entries.filter(([, v]) => v.status === "passed").length;
      const failed = entries.filter(([, v]) => v.status === "failed");
      console.log(`  Gates      ${passed}/10 passed`);
      for (const [num, v] of failed) {
        console.log(`             Gate ${num} FAILED: ${v.error?.slice(0, 60) || "unknown"}`);
      }
    }
  }

  // 4. Theme
  const theme = readJsonSafe(join(root, ".ogu/THEME.json"));
  if (theme?.mood) {
    console.log(`\n  Theme      ${theme.mood}`);
    if (theme.generated_tokens?.colors?.primary) {
      console.log(`  Primary    ${theme.generated_tokens.colors.primary}`);
    }
  }

  // 5. Feature overview
  const featuresDir = join(root, "docs/vault/04_Features");
  if (existsSync(featuresDir)) {
    const features = scanFeatures(root, featuresDir);
    const total = features.length;
    const done = features.filter((f) => f.phase === "done").length;
    const inProgress = features.filter((f) => f.phase !== "done" && f.phase !== "idea").length;

    console.log(`\n  Features   ${total} total, ${done} done, ${inProgress} in progress`);

    // Show non-done features
    const active = features.filter((f) => f.phase !== "done");
    if (active.length > 0 && active.length <= 8) {
      for (const f of active) {
        const marker = f.slug === currentTask ? " ◀" : "";
        console.log(`             ${f.phase.padEnd(10)} ${f.slug}${marker}`);
      }
    }
  }

  // 6. Health
  const doctorPath = join(root, ".ogu/DOCTOR.md");
  if (existsSync(doctorPath)) {
    const doctorContent = readFileSync(doctorPath, "utf-8");
    if (doctorContent.includes("PASSED")) {
      console.log(`\n  Health     PASSED`);
    } else {
      console.log(`\n  Health     ISSUES DETECTED (run: ogu doctor)`);
    }
  } else {
    console.log(`\n  Health     Unknown (run: ogu doctor)`);
  }

  // 7. Trends summary
  const trendsPath = join(root, ".ogu/TRENDS.md");
  if (existsSync(trendsPath)) {
    const trendsContent = readFileSync(trendsPath, "utf-8");
    const trendMatch = trendsContent.match(/Overall Trend:\s*(\w+)/i);
    if (trendMatch) {
      console.log(`  Trend      ${trendMatch[1]}`);
    }
  }

  // 8. Memory stats
  const memoryPath = join(root, ".ogu/MEMORY.md");
  if (existsSync(memoryPath)) {
    const lines = readFileSync(memoryPath, "utf-8").split("\n").filter((l) => l.trim().startsWith("- ")).length;
    console.log(`  Memory     ${lines} entries`);
  }

  // 9. Snapshots (time-travel)
  try {
    const snaps = listSnapshots({ root });
    if (snaps.length > 0) {
      const latest = snaps[snaps.length - 1];
      console.log(`  Snapshots  ${snaps.length} total, latest: ${latest.label} (${timeSince(latest.timestamp)})`);

      // Load latest snapshot into time-travel engine for in-memory replay
      _timeTravelEngine.setState({ latestSnapshot: latest.id, snapCount: snaps.length });
      _timeTravelEngine.takeSnapshot('status-check');

      // Version the snapshot list via snapshot versioner
      _snapshotVersioner.commit({ count: snaps.length, latestId: latest.id, checkedAt: new Date().toISOString() });
    }
  } catch { /* best-effort — snapshots dir may not exist */ }

  // 10. Observation
  const observeConfig = readJsonSafe(join(root, ".ogu/OBSERVE.json"));
  if (observeConfig?.last_observation) {
    const ago = timeSince(observeConfig.last_observation);
    const sources = observeConfig.sources?.filter((s) => s.enabled).length || 0;
    console.log(`  Observe    ${sources} source(s), last: ${ago}`);
  }

  console.log("\n  " + "─".repeat(50));
  console.log("");

  return 0;
}

// ---------------------------------------------------------------------------

function detectPhase(root, slug) {
  const featureDir = join(root, `docs/vault/04_Features/${slug}`);
  if (!existsSync(featureDir)) return "unknown";

  const metrics = readJsonSafe(join(featureDir, "METRICS.json"));
  if (metrics?.completed) return "done";

  const plan = readJsonSafe(join(featureDir, "Plan.json"));
  if (plan?.tasks?.length > 0) {
    const specPath = join(featureDir, "Spec.md");
    if (existsSync(specPath)) {
      const specContent = readFileSync(specPath, "utf-8");
      if (!specContent.includes("<!-- TO BE FILLED BY /architect -->")) {
        return "ready";  // architect done, ready for build
      }
    }
    return "architect";
  }

  const specPath = join(featureDir, "Spec.md");
  if (existsSync(specPath)) {
    const specContent = readFileSync(specPath, "utf-8");
    if (specContent.includes("<!-- TO BE FILLED BY /architect -->")) {
      return "feature";  // /feature done, needs /architect
    }
  }

  const prdPath = join(featureDir, "PRD.md");
  if (existsSync(prdPath)) return "feature";

  return "idea";
}

function scanFeatures(root, featuresDir) {
  const features = [];
  try {
    for (const slug of readdirSync(featuresDir)) {
      if (slug === "README.md" || slug === "Index.md" || slug.startsWith(".")) continue;
      const fullPath = join(featuresDir, slug);
      try {
        // Check if it's a directory
        const stat = readdirSync(fullPath);
        features.push({
          slug,
          phase: detectPhase(root, slug),
        });
      } catch { /* not a directory */ }
    }
  } catch { /* skip */ }

  // Sort: in-progress first, then by name
  const phaseOrder = { ready: 0, architect: 1, feature: 2, idea: 3, done: 4, unknown: 5 };
  features.sort((a, b) => (phaseOrder[a.phase] ?? 5) - (phaseOrder[b.phase] ?? 5));

  return features;
}

function timeSince(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
