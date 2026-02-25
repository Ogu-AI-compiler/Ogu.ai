import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";
import { repoRoot, globalRoot, readJsonSafe } from "../util.mjs";

export async function learn() {
  const root = repoRoot();
  const global = globalRoot();

  // Ensure global memory directory exists
  const memDir = join(global, "global-memory");
  mkdirSync(memDir, { recursive: true });

  // Load existing patterns
  const patternsPath = join(memDir, "patterns.json");
  const store = readJsonSafe(patternsPath) || { version: 1, patterns: [] };

  // Detect project info
  const profile = readJsonSafe(join(root, ".ogu/PROFILE.json"));
  const projectName = basename(root);
  const platform = profile?.platform || "unknown";
  const stack = detectStack(root);

  // Load metrics
  const metrics = readJsonSafe(join(root, ".ogu/METRICS.json"));

  // Load MEMORY.md
  const memoryPath = join(root, ".ogu/MEMORY.md");
  const memoryContent = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : "";

  // Scan completed features
  const featuresDir = join(root, "docs/vault/04_Features");
  const completedFeatures = findCompletedFeatures(root, featuresDir, metrics);

  if (completedFeatures.length === 0) {
    console.log("  No completed features found to learn from.");
    console.log("  Complete a feature and run /done before using learn.");
    return 0;
  }

  // Extract patterns from each completed feature
  let newPatterns = 0;
  for (const feature of completedFeatures) {
    const patterns = extractPatterns(root, feature, projectName, platform, stack, metrics, memoryContent);

    for (const pattern of patterns) {
      // Check for duplicates
      const exists = store.patterns.find((p) =>
        p.summary === pattern.summary && p.source_project === pattern.source_project
      );
      if (exists) {
        // Update existing pattern
        exists.times_applied = (exists.times_applied || 0) + 1;
        exists.confidence = computeConfidence(exists);
        console.log(`  update   ${pattern.summary.slice(0, 50)}...`);
      } else {
        store.patterns.push(pattern);
        newPatterns++;
        console.log(`  learn    ${pattern.summary.slice(0, 50)}...`);
      }
    }
  }

  // Write back
  writeFileSync(patternsPath, JSON.stringify(store, null, 2) + "\n", "utf-8");

  console.log("");
  console.log(`  project  ${projectName}`);
  console.log(`  features ${completedFeatures.length} completed`);
  console.log(`  patterns ${newPatterns} new, ${store.patterns.length} total`);
  console.log(`  store    ${patternsPath}`);

  return 0;
}

// ---------------------------------------------------------------------------

function detectStack(root) {
  const tags = [];
  const pkg = readJsonSafe(join(root, "package.json"));
  if (!pkg) return tags;

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
  if (allDeps.tamagui) tags.push("tamagui");

  return tags;
}

function findCompletedFeatures(root, featuresDir, metrics) {
  const completed = [];
  if (!existsSync(featuresDir)) return completed;

  try {
    for (const slug of readdirSync(featuresDir)) {
      if (slug === "README.md") continue;
      const planPath = join(featuresDir, slug, "Plan.json");
      const plan = readJsonSafe(planPath);
      if (!plan?.tasks || plan.tasks.length === 0) continue;

      // Check if feature is in metrics as completed
      const featureMetrics = metrics?.features?.[slug];
      if (featureMetrics?.completed) {
        completed.push({
          slug,
          plan,
          metrics: featureMetrics,
        });
        continue;
      }

      // Fallback: check if all tasks appear done in daily logs
      const logDir = join(root, ".ogu/memory");
      if (existsSync(logDir)) {
        const logs = readdirSync(logDir)
          .filter((f) => f.endsWith(".md"))
          .map((f) => readFileSync(join(logDir, f), "utf-8"))
          .join("\n");

        if (logs.includes(`Completion gate PASSED`) && logs.includes(slug)) {
          completed.push({ slug, plan, metrics: featureMetrics });
        }
      }
    }
  } catch { /* skip */ }

  return completed;
}

function extractPatterns(root, feature, projectName, platform, stack, metrics, memoryContent) {
  const patterns = [];
  const featureMetrics = feature.metrics || {};
  const gateResults = featureMetrics.gate_results || {};

  // Detect domain from feature content
  const domain = detectDomain(root, feature.slug);

  // Check for production issues (observe → learn connection)
  const perFeatureMetrics = readJsonSafe(join(root, `docs/vault/04_Features/${feature.slug}/METRICS.json`)) || {};
  const hasProductionIssues = (perFeatureMetrics.production_issues?.length || 0) > 0;
  const productionValidated = !hasProductionIssues;

  // Extract from gate failures — what went wrong and was fixed
  for (const [gate, result] of Object.entries(gateResults)) {
    if (result.attempts > 1 && result.failures?.length > 0) {
      patterns.push(createPattern({
        source_project: projectName,
        source_feature: feature.slug,
        category: "universal",
        tags: stack,
        platform,
        domain,
        summary: `Gate "${gate}" failed ${result.attempts - 1}x before passing: ${result.failures[0]}`,
        detail: `Failures: ${result.failures.join("; ")}`,
        outcome: {
          gates_failed_before: [gate],
          gates_failed_after: [],
          fix_time_minutes: null,
          issue_type: `gate-${gate}-failure`,
        },
        production_validated: productionValidated,
        confidence: hasProductionIssues ? "low" : undefined,
      }));
    }
  }

  // Extract from Plan.json task patterns
  if (feature.plan?.tasks) {
    for (const task of feature.plan.tasks) {
      if (task.touches?.length > 0) {
        patterns.push(createPattern({
          source_project: projectName,
          source_feature: feature.slug,
          category: "stack",
          tags: stack,
          platform,
          domain,
          summary: `Task "${task.title}" touches: ${task.touches.join(", ")}`,
          detail: `done_when: ${task.done_when || "N/A"}`,
          outcome: {
            gates_failed_before: [],
            gates_failed_after: [],
            fix_time_minutes: null,
            issue_type: "implementation-pattern",
          },
        }));
      }
    }
  }

  // Extract from ADRs
  const adrsDir = join(root, "docs/vault/03_ADRs");
  if (existsSync(adrsDir)) {
    try {
      for (const file of readdirSync(adrsDir)) {
        if (!file.endsWith(".md") || file === "ADR_0001_template.md") continue;
        const content = readFileSync(join(adrsDir, file), "utf-8");
        const titleMatch = content.match(/^# ADR \d+ — (.+)/m);
        const decisionMatch = content.match(/## Decision\n\n([\s\S]*?)(?=\n## )/);

        if (titleMatch && decisionMatch) {
          patterns.push(createPattern({
            source_project: projectName,
            source_feature: feature.slug,
            category: "stack",
            tags: stack,
            platform,
            domain,
            summary: `ADR: ${titleMatch[1].trim()}`,
            detail: decisionMatch[1].trim().slice(0, 200),
            outcome: {
              gates_failed_before: [],
              gates_failed_after: [],
              fix_time_minutes: null,
              issue_type: "architectural-decision",
            },
          }));
        }
      }
    } catch { /* skip */ }
  }

  return patterns;
}

function createPattern(data) {
  const id = `p-${createHash("sha256").update(data.summary + data.source_project).digest("hex").slice(0, 8)}`;
  return {
    id,
    source_project: data.source_project,
    source_feature: data.source_feature,
    category: data.category,
    tags: data.tags || [],
    platform: data.platform || "unknown",
    domain: data.domain || "general",
    summary: data.summary,
    detail: data.detail || "",
    outcome: data.outcome || {},
    applications: [],
    production_validated: data.production_validated ?? false,
    confidence: data.confidence || "medium",
    times_applied: 1,
    times_rejected: 0,
    created_at: new Date().toISOString(),
  };
}

const DOMAIN_KEYWORDS = {
  "e-commerce": ["cart", "checkout", "payment", "product", "catalog", "order", "shipping", "inventory", "price", "shop", "store"],
  "social": ["feed", "post", "comment", "like", "follow", "friend", "profile", "share", "notification", "chat", "message"],
  "productivity": ["task", "todo", "project", "kanban", "board", "calendar", "schedule", "reminder", "note", "workspace"],
  "education": ["course", "lesson", "quiz", "student", "teacher", "grade", "learning", "curriculum", "enrollment"],
  "healthcare": ["patient", "appointment", "diagnosis", "medical", "health", "prescription", "doctor", "clinic"],
  "finance": ["account", "transaction", "balance", "transfer", "budget", "invoice", "billing", "subscription"],
  "media": ["video", "audio", "stream", "playlist", "upload", "media", "player", "content", "podcast"],
  "crm": ["contact", "lead", "deal", "pipeline", "customer", "sales", "opportunity", "campaign"],
};

function detectDomain(root, slug) {
  // Read PRD and Spec for domain signals
  const prdPath = join(root, `docs/vault/04_Features/${slug}/PRD.md`);
  const specPath = join(root, `docs/vault/04_Features/${slug}/Spec.md`);

  let content = "";
  if (existsSync(prdPath)) content += readFileSync(prdPath, "utf-8").toLowerCase();
  if (existsSync(specPath)) content += " " + readFileSync(specPath, "utf-8").toLowerCase();

  if (!content.trim()) return "general";

  // Score each domain by keyword matches
  let bestDomain = "general";
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const matches = content.split(kw).length - 1;
      score += matches;
    }
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  // Require at least 3 keyword hits to classify
  return bestScore >= 3 ? bestDomain : "general";
}

function computeConfidence(pattern) {
  const total = (pattern.times_applied || 0) + (pattern.times_rejected || 0);
  if (total === 0) return "low";
  const ratio = (pattern.times_applied || 0) / total;
  if (ratio >= 0.7) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
}
