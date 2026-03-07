/**
 * playbook-generator.mjs — Slice 387
 * Uses hand-written playbooks as few-shot examples + LLM to generate
 * playbooks for the remaining ~57 roles.
 */

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { getRoleConfig } from "./role-taxonomy.mjs";
import { listAvailablePlaybooks, loadPlaybook, ROLE_SLUG_MAP, parsePlaybook } from "./playbook-loader.mjs";

/**
 * buildPlaybookPrompt({ roleSlug, displayName, category, exemplars }) → LLM prompt string
 *
 * exemplars: [{ roleSlug, category, content }] — 2-3 hand-written playbooks as few-shot examples
 */
export function buildPlaybookPrompt({ roleSlug, displayName, category, exemplars }) {
  const sections = [
    `You are a technical writing expert creating an operational playbook for the role: ${displayName} (category: ${category}).`,
    "",
    "The playbook must follow this exact format:",
    "1. YAML frontmatter with: role, category, min_tier, capacity_units",
    "2. Sections: Core Methodology, Checklists, Anti-Patterns, When to Escalate",
    "3. A skills marker at the bottom: <!-- skills: skill-a, skill-b, ... -->",
    "4. Between 300-500 lines of deep, actionable operational knowledge",
    "5. No generic advice. Every point must be specific and actionable.",
    "",
  ];

  if (exemplars && exemplars.length > 0) {
    sections.push("Here are example playbooks to follow as templates:\n");
    for (const ex of exemplars.slice(0, 3)) {
      sections.push(`--- EXAMPLE: ${ex.roleSlug} (${ex.category}) ---`);
      // Truncate to first 150 lines to stay within context
      const lines = ex.content.split("\n").slice(0, 150);
      sections.push(lines.join("\n"));
      sections.push("--- END EXAMPLE ---\n");
    }
  }

  sections.push(`Now write the full playbook for: ${displayName} (slug: ${roleSlug}, category: ${category}).`);
  sections.push("Include the YAML frontmatter, all required sections, and the skills marker.");

  return sections.join("\n");
}

/**
 * validatePlaybook(content, roleSlug) → { valid, errors }
 */
export function validatePlaybook(content, roleSlug) {
  const errors = [];

  if (typeof content !== "string" || content.length < 100) {
    errors.push("Content too short (minimum 100 characters)");
    return { valid: false, errors };
  }

  // Check frontmatter
  if (!content.startsWith("---")) {
    errors.push("Missing YAML frontmatter (must start with ---)");
  }

  // Check required sections
  const requiredSections = ["Core Methodology", "Checklists", "Anti-Patterns", "When to Escalate"];
  for (const section of requiredSections) {
    if (!content.includes(`## ${section}`)) {
      errors.push(`Missing required section: ## ${section}`);
    }
  }

  // Check skills marker
  if (!content.includes("<!-- skills:")) {
    errors.push("Missing skills marker (<!-- skills: ... -->)");
  }

  // Check minimum line count
  const lineCount = content.split("\n").length;
  if (lineCount < 100) {
    errors.push(`Too few lines: ${lineCount} (minimum 100)`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * generatePlaybook({ roleSlug, category, exemplarPlaybooks, llmClient }) → markdown string
 *
 * llmClient: async function that takes { prompt } and returns { content }
 */
export async function generatePlaybook({ roleSlug, category, exemplarPlaybooks, llmClient }) {
  const config = getRoleConfig(roleSlug);
  if (!config) throw new Error(`Unknown role: ${roleSlug}`);

  const prompt = buildPlaybookPrompt({
    roleSlug,
    displayName: config.displayName,
    category: config.category,
    exemplars: exemplarPlaybooks || [],
  });

  if (!llmClient) {
    throw new Error("llmClient is required for playbook generation");
  }

  const result = await llmClient({ prompt });
  const content = result.content || result;

  const validation = validatePlaybook(content, roleSlug);
  if (!validation.valid) {
    throw new Error(`Generated playbook validation failed: ${validation.errors.join(", ")}`);
  }

  return content;
}

/**
 * generateAllMissing({ playbooksDir, llmClient, dryRun }) → { generated, skipped, errors }
 */
export async function generateAllMissing({ playbooksDir, llmClient, dryRun = false }) {
  const existing = listAvailablePlaybooks(playbooksDir);
  const existingSlugs = new Set(existing.map(p => p.roleSlug));

  // Load exemplar playbooks for few-shot
  const exemplars = existing.slice(0, 3).map(p => {
    const pb = loadPlaybook(p.path);
    return { roleSlug: p.roleSlug, category: p.category, content: pb.body };
  });

  const results = { generated: [], skipped: [], errors: [] };

  for (const [slug, relativePath] of Object.entries(ROLE_SLUG_MAP)) {
    if (existingSlugs.has(slug)) {
      results.skipped.push(slug);
      continue;
    }

    const config = getRoleConfig(slug);
    if (!config) {
      results.errors.push({ slug, error: "Not in taxonomy" });
      continue;
    }

    if (dryRun) {
      results.generated.push(slug);
      continue;
    }

    try {
      const content = await generatePlaybook({
        roleSlug: slug,
        category: config.category,
        exemplarPlaybooks: exemplars,
        llmClient,
      });

      const outPath = join(playbooksDir, relativePath);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, content, "utf-8");
      results.generated.push(slug);
    } catch (err) {
      results.errors.push({ slug, error: err.message });
    }
  }

  return results;
}
