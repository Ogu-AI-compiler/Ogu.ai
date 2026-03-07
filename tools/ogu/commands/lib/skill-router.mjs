/**
 * skill-router.mjs — Slice 397
 * Routes incoming tasks to relevant skills (lazy loading).
 *
 * Instead of statically injecting all skill descriptions into every agent prompt,
 * the router identifies which skills are relevant to a specific task and loads
 * only those SKILL.md files into context (Level 2 progressive loading).
 *
 * Loading levels (Claude Skills progressive context):
 *   Level 1 — frontmatter only (~100 tokens) — always available in agent profile
 *   Level 2 — SKILL.md body — loaded when skill is routed for a task
 *   Level 3 — scripts/ or reference files — loaded on demand within skill body
 *
 * Usage:
 *   const { routeTask } = await import("./skill-router.mjs");
 *   const { skills, context } = routeTask(taskDescription, agentSkillDefs, skillsDir);
 *   // inject context into task prompt
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSkillFrontmatter } from "./skill-loader.mjs";

// ── Trigger extraction ────────────────────────────────────────────────────────

/**
 * extractTriggers(description) → string[]
 * Parses trigger phrases from a SKILL.md description field.
 * Handles format: Triggers: "phrase1", "phrase2", "phrase3".
 */
export function extractTriggers(description) {
  if (!description) return [];

  const triggersMatch = description.match(/Triggers?:\s*(.+?)\.?\s*$/i);
  if (!triggersMatch) return [];

  const rawTriggers = triggersMatch[1];
  return rawTriggers
    .split(/,\s*/)
    .map(t => t.trim().replace(/^["']|["']$/g, "").toLowerCase())
    .filter(Boolean);
}

// ── Keyword scorer ────────────────────────────────────────────────────────────

/**
 * scoreSkillForTask(skill, taskText) → number
 * Scores how relevant a skill is for a given task description.
 * Higher = more relevant.
 */
export function scoreSkillForTask(skill, taskText) {
  if (!skill?.name || !taskText) return 0;

  const text = taskText.toLowerCase();
  let score = 0;

  const skillWords = skill.name.split("-");
  const triggers = extractTriggers(skill.description || "");

  // Exact skill name match
  if (text.includes(skill.name.toLowerCase())) score += 10;

  // Trigger phrase match (quoted phrases from Triggers: section)
  for (const trigger of triggers) {
    if (text.includes(trigger)) score += 8;
  }

  // Skill slug words match
  for (const word of skillWords) {
    if (word.length > 3 && text.includes(word)) score += 2;
  }

  // Description keyword match (non-trigger words)
  if (skill.description) {
    const descWords = skill.description
      .toLowerCase()
      .replace(/triggers?:.*$/i, "")
      .split(/\W+/)
      .filter(w => w.length > 4);

    for (const word of descWords) {
      if (text.includes(word)) score += 0.5;
    }
  }

  return score;
}

// ── Core router ───────────────────────────────────────────────────────────────

/**
 * routeTask(taskDescription, skillDefs, skillsDir, opts?) → RouteResult
 *
 * taskDescription: string — the incoming task text
 * skillDefs: [{ name, description }] — agent's skill definitions (Level 1)
 * skillsDir: string — path to skills directory (for loading bodies)
 * opts.maxSkills: number — max skills to activate (default: 3)
 * opts.minScore: number — minimum score threshold (default: 1)
 * opts.loadBodies: boolean — load SKILL.md body for matched skills (default: true)
 *
 * Returns:
 *   skills: [{ name, description, body?, score }] — matched skills sorted by score
 *   context: string — formatted skill context to inject into task prompt
 *   totalMatched: number
 */
export function routeTask(taskDescription, skillDefs, skillsDir, opts = {}) {
  const maxSkills = opts.maxSkills ?? 3;
  const minScore = opts.minScore ?? 1;
  const loadBodies = opts.loadBodies !== false;

  if (!taskDescription || !Array.isArray(skillDefs) || skillDefs.length === 0) {
    return { skills: [], context: "", totalMatched: 0 };
  }

  // Score each skill
  const scored = skillDefs
    .map(skill => ({ ...skill, score: scoreSkillForTask(skill, taskDescription) }))
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score);

  const matched = scored.slice(0, maxSkills);

  // Load SKILL.md bodies for matched skills (Level 2)
  if (loadBodies && skillsDir) {
    for (const skill of matched) {
      const skillPath = join(skillsDir, skill.name, "SKILL.md");
      if (existsSync(skillPath)) {
        try {
          const raw = readFileSync(skillPath, "utf-8");
          const parsed = parseSkillFrontmatter(raw);
          if (parsed.body) {
            skill.body = parsed.body;
          }
        } catch { /* skip — body stays undefined */ }
      }
    }
  }

  // Build context string
  const context = buildTaskContext(matched);

  return {
    skills: matched,
    context,
    totalMatched: scored.length,
  };
}

// ── Context builder ───────────────────────────────────────────────────────────

/**
 * buildTaskContext(skills) → string
 * Formats matched skills into a context block for injection into task prompts.
 * If body is available (Level 2), includes the full workflow.
 * Otherwise falls back to description only (Level 1).
 */
export function buildTaskContext(skills) {
  if (!skills || skills.length === 0) return "";

  const sections = ["## Active Skills for This Task"];

  for (const skill of skills) {
    if (skill.body) {
      // Level 2: full body loaded
      sections.push(`### ${skill.name}\n\n${skill.body.trim()}`);
    } else {
      // Level 1: description only
      sections.push(`### ${skill.name}\n\n${skill.description || ""}`);
    }
  }

  return sections.join("\n\n---\n\n");
}

// ── Static injection (legacy / fallback) ─────────────────────────────────────

/**
 * buildStaticSkillsSection(skillDefs) → string
 * Produces a static skills summary for inclusion in agent system prompts.
 * This is the Level 1 approach (always-loaded, frontmatter only).
 * Use routeTask() instead for per-task lazy loading.
 */
export function buildStaticSkillsSection(skillDefs) {
  if (!Array.isArray(skillDefs) || skillDefs.length === 0) return "";
  const lines = ["## Skill Inventory"];
  for (const s of skillDefs) {
    if (s?.name && s?.description) {
      lines.push(`- **${s.name}**: ${s.description}`);
    }
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

// ── Skill selector ────────────────────────────────────────────────────────────

/**
 * selectSkillsForRoles(roleSkills, specialtySkills, dnaStrengthSkills, opts?) → string[]
 * Merges skill lists from role, specialty, and DNA strength with deduplication.
 * Returns sorted unique slug array.
 * opts.limit: max number of skills to return (default: unlimited)
 */
export function selectSkillsForRoles(roleSkills = [], specialtySkills = [], dnaStrengthSkills = [], opts = {}) {
  const combined = [...new Set([...roleSkills, ...specialtySkills, ...dnaStrengthSkills])];
  if (opts.limit && combined.length > opts.limit) {
    return combined.slice(0, opts.limit);
  }
  return combined;
}
