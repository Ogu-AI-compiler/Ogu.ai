/**
 * skill-loader.mjs — Slice 395
 * Loads skill definitions from SKILL.md files (Claude Skills format).
 * Falls back to auto-generated descriptions for skills without a SKILL.md.
 *
 * Skill file structure (Claude Skills format):
 *   tools/ogu/skills/{skill-name}/
 *   └── SKILL.md   ← required (YAML frontmatter: name + description)
 *
 * YAML frontmatter format:
 *   ---
 *   name: skill-name
 *   description: What it does. Use when [trigger]. Triggers: "phrase1", "phrase2".
 *   ---
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ── Auto-description generator ──────────────────────────────────────────────

/**
 * autoDescription(name) → string
 * Generates a fallback description from the skill slug when no SKILL.md exists.
 * Format follows Claude Skills guide: "[What it does]. Use when [trigger]. Triggers: ..."
 */
export function autoDescription(name) {
  const words = name.split("-").join(" ");
  const cap   = words.charAt(0).toUpperCase() + words.slice(1);
  return `${cap} expertise for technical tasks and workflows. Use when ${words} knowledge is required or when asked to perform ${words}-related work. Triggers: "${words}", "help with ${words}", "need ${name}".`;
}

// ── SKILL.md parser ──────────────────────────────────────────────────────────

/**
 * parseSkillFrontmatter(content) → { name, description, body }
 * Parses YAML frontmatter from a SKILL.md file.
 */
export function parseSkillFrontmatter(content) {
  if (typeof content !== "string") return { name: null, description: null, body: "" };

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return { name: null, description: null, body: content.trim() };

  const frontmatter = {};
  for (const line of fmMatch[1].split("\n")) {
    const m = line.match(/^(\w+)\s*:\s*(.+)/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      frontmatter[m[1]] = val;
    }
  }

  return {
    name:        frontmatter.name        || null,
    description: frontmatter.description || null,
    body:        fmMatch[2].trim(),
  };
}

// ── Loader ───────────────────────────────────────────────────────────────────

/**
 * loadSkill(skillsDir, name) → { name, description, body } | null
 * Loads a single skill from its SKILL.md file.
 * Returns null if the SKILL.md does not exist.
 */
export function loadSkill(skillsDir, name) {
  const skillPath = join(skillsDir, name, "SKILL.md");
  if (!existsSync(skillPath)) return null;

  try {
    const content = readFileSync(skillPath, "utf-8");
    const parsed  = parseSkillFrontmatter(content);
    return {
      name:        parsed.name        || name,
      description: parsed.description || autoDescription(name),
      body:        parsed.body,
    };
  } catch {
    return null;
  }
}

/**
 * resolveSkills(skillsDir, names) → [{ name, description }]
 * Resolves an array of skill names to objects with descriptions.
 * Uses SKILL.md if available; auto-generates description otherwise.
 */
export function resolveSkills(skillsDir, names) {
  if (!Array.isArray(names)) return [];
  return names.map(name => {
    const skill = loadSkill(skillsDir, name);
    if (skill) return { name: skill.name, description: skill.description };
    return { name, description: autoDescription(name) };
  });
}

/**
 * listSkills(skillsDir) → [{ name, description }]
 * Lists all skills in the library (all directories in skillsDir).
 */
export function listSkills(skillsDir) {
  if (!existsSync(skillsDir)) return [];
  try {
    return readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const skill = loadSkill(skillsDir, d.name);
        return skill || { name: d.name, description: autoDescription(d.name), body: "" };
      });
  } catch {
    return [];
  }
}

/**
 * defaultSkillsDir() → absolute path to tools/ogu/skills/
 */
export function defaultSkillsDir() {
  const thisFile = fileURLToPath(new URL(import.meta.url));
  return join(thisFile, "..", "..", "..", "skills");
}
