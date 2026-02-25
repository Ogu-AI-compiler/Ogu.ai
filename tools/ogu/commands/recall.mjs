import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { repoRoot, globalRoot, readJsonSafe } from "../util.mjs";

export async function recall() {
  const root = repoRoot();
  const global = globalRoot();

  const patternsPath = join(global, "global-memory/patterns.json");
  const store = readJsonSafe(patternsPath);

  if (!store || !store.patterns || store.patterns.length === 0) {
    console.log("  No cross-project patterns found.");
    console.log("  Complete features and run `ogu learn` to build the pattern store.");
    return 0;
  }

  // Detect current project context
  const profile = readJsonSafe(join(root, ".ogu/PROFILE.json"));
  const projectName = basename(root);
  const platform = profile?.platform || "unknown";
  const currentStack = detectCurrentStack(root);

  // Get current feature context (if any)
  const state = readJsonSafe(join(root, ".ogu/STATE.json"));
  const currentFeature = state?.current_task;
  let featureContext = null;
  if (currentFeature) {
    const specPath = join(root, `docs/vault/04_Features/${currentFeature}/Spec.md`);
    if (existsSync(specPath)) {
      featureContext = readFileSync(specPath, "utf-8").slice(0, 500);
    }
  }

  // Detect current project domain
  const currentDomain = detectCurrentDomain(root, currentFeature);

  // Score and filter patterns
  const scored = store.patterns
    .filter((p) => p.source_project !== projectName) // Don't recall own patterns
    .map((p) => ({
      ...p,
      relevance: scoreRelevance(p, currentStack, platform, currentDomain),
    }))
    .filter((p) => p.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 10);

  if (scored.length === 0) {
    console.log("  No relevant patterns found for current project context.");
    console.log(`  Project: ${projectName} (${platform})`);
    console.log(`  Stack: ${currentStack.join(", ") || "unknown"}`);
    console.log(`  Total patterns in store: ${store.patterns.length}`);
    return 0;
  }

  // Output
  console.log(`\n  Cross-project patterns for "${currentFeature || projectName}" (${platform}, ${currentStack.join(", ")}):`);
  console.log("");

  for (let i = 0; i < scored.length; i++) {
    const p = scored[i];
    const conf = p.confidence.toUpperCase().padEnd(4);
    const applied = p.times_applied || 0;
    const rejected = p.times_rejected || 0;

    const prodStatus = p.production_validated ? "VALIDATED" : "UNVALIDATED";

    console.log(`  [${i + 1}] ${conf}  ${p.summary}`);
    console.log(`         Source: ${p.source_project}/${p.source_feature} | Applied ${applied}x, rejected ${rejected}x`);
    console.log(`         Production: ${prodStatus}`);

    if (p.outcome?.gates_failed_before?.length > 0) {
      console.log(`         Outcome: Fixed ${p.outcome.gates_failed_before.join(", ")} failures`);
    }
    if (p.outcome?.issue_type) {
      console.log(`         Type: ${p.outcome.issue_type}`);
    }
    console.log("");
  }

  console.log(`  ${scored.length} patterns found. Use /preflight or /build to apply relevant ones.`);
  console.log(`  Accept/reject patterns by editing ~/.ogu/global-memory/patterns.json`);

  return 0;
}

// ---------------------------------------------------------------------------

function detectCurrentStack(root) {
  const tags = [];
  const pkgPaths = [
    join(root, "package.json"),
    join(root, "apps/web/package.json"),
    join(root, "apps/api/package.json"),
  ];

  for (const pkgPath of pkgPaths) {
    const pkg = readJsonSafe(pkgPath);
    if (!pkg) continue;

    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (allDeps.typescript) tags.push("typescript");
    if (allDeps.next) tags.push("nextjs");
    if (allDeps.react) tags.push("react");
    if (allDeps.fastify) tags.push("fastify");
    if (allDeps.express) tags.push("express");
    if (allDeps.prisma || allDeps["@prisma/client"]) tags.push("prisma");
    if (allDeps.tailwindcss) tags.push("tailwind");
    if (allDeps.vue) tags.push("vue");
    if (allDeps.svelte) tags.push("svelte");
    if (allDeps["react-native"]) tags.push("react-native");
  }

  return [...new Set(tags)];
}

function detectCurrentDomain(root, currentFeature) {
  if (!currentFeature) return "general";

  const prdPath = join(root, `docs/vault/04_Features/${currentFeature}/PRD.md`);
  const specPath = join(root, `docs/vault/04_Features/${currentFeature}/Spec.md`);

  let content = "";
  if (existsSync(prdPath)) content += readFileSync(prdPath, "utf-8").toLowerCase();
  if (existsSync(specPath)) content += " " + readFileSync(specPath, "utf-8").toLowerCase();

  if (!content.trim()) return "general";

  const DOMAIN_KEYWORDS = {
    "e-commerce": ["cart", "checkout", "payment", "product", "order", "shipping", "price", "shop"],
    "social": ["feed", "post", "comment", "like", "follow", "profile", "share", "chat"],
    "productivity": ["task", "todo", "project", "kanban", "board", "calendar", "note", "workspace"],
    "education": ["course", "lesson", "quiz", "student", "teacher", "grade", "learning"],
    "healthcare": ["patient", "appointment", "medical", "health", "prescription", "doctor"],
    "finance": ["account", "transaction", "balance", "budget", "invoice", "billing", "subscription"],
    "media": ["video", "audio", "stream", "playlist", "media", "player", "podcast"],
    "crm": ["contact", "lead", "deal", "pipeline", "customer", "sales", "campaign"],
  };

  let bestDomain = "general";
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      score += content.split(kw).length - 1;
    }
    if (score > bestScore) { bestScore = score; bestDomain = domain; }
  }

  return bestScore >= 3 ? bestDomain : "general";
}

function scoreRelevance(pattern, currentStack, currentPlatform, currentDomain) {
  let score = 0;

  // Domain match (4 points — strongest signal)
  if (pattern.domain && pattern.domain !== "general" && pattern.domain === currentDomain) score += 4;

  // Penalize domain mismatch (both have specific domains but they differ)
  if (pattern.domain && pattern.domain !== "general" && currentDomain !== "general" && pattern.domain !== currentDomain) score -= 2;

  // Stack match (3 points per matching tag)
  const patternTags = pattern.tags || [];
  for (const tag of patternTags) {
    if (currentStack.includes(tag)) score += 3;
  }

  // Platform match (2 points)
  if (pattern.platform === currentPlatform) score += 2;

  // Universal patterns always get 1 point
  if (pattern.category === "universal") score += 1;

  // Production validation bonus/penalty
  if (pattern.production_validated === true) score += 2;
  else if (pattern.production_validated === false) score -= 1;

  // Confidence bonus
  if (pattern.confidence === "high") score += 2;
  else if (pattern.confidence === "medium") score += 1;

  // Penalize low-confidence patterns
  if (pattern.confidence === "low") score -= 1;

  // Penalize heavily rejected patterns
  if (pattern.times_rejected > pattern.times_applied) score -= 2;

  return Math.max(0, score);
}
