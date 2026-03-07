/**
 * prompt-assembler.mjs — Slice 384
 * Assembles 4-layer system prompts from playbook, specialty, DNA, and experience.
 *
 * Layer 1: Base Playbook body
 * Layer 2: Specialty Addendum body
 * Layer 3: DNA Style Layer (formatted from 6 DNA dimensions)
 * Layer 4: Experience Addendum (learned rules checklist)
 */

const LAYER_SEPARATOR = "\n\n---\n\n";

/**
 * buildSkillsLayer(skillDefs) → formatted Skills Definitions section
 * skillDefs: [{ name, description }]
 * Each skill follows Claude Skills format: name + description.
 */
export function buildSkillsLayer(skillDefs) {
  if (!Array.isArray(skillDefs) || skillDefs.length === 0) return "";
  const lines = ["## Skill Definitions"];
  for (const s of skillDefs) {
    if (s && s.name && s.description) {
      lines.push(`**${s.name}**: ${s.description}`);
    }
  }
  if (lines.length === 1) return ""; // only heading, no skills added
  return lines.join("\n");
}

const DNA_DIMENSIONS = [
  "work_style",
  "communication_style",
  "risk_appetite",
  "strength_bias",
  "tooling_bias",
  "failure_strategy",
];

/**
 * buildDnaLayer(dna) → formatted DNA text
 */
export function buildDnaLayer(dna) {
  if (!dna || typeof dna !== "object") return "";

  const items = [];
  for (const dim of DNA_DIMENSIONS) {
    const val = dna[dim];
    if (val) {
      const label = dim.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      items.push(`- **${label}**: ${val}`);
    }
  }
  if (items.length === 0) return "";
  return ["## Agent DNA Profile", ...items].join("\n");
}

/**
 * buildExperienceLayer(digest) → formatted checklist
 * digest is a string of rules separated by newlines, or empty.
 */
export function buildExperienceLayer(digest) {
  if (!digest || typeof digest !== "string" || !digest.trim()) {
    return "";
  }

  const rules = digest.split("\n").map(l => l.trim()).filter(Boolean);
  if (rules.length === 0) return "";

  const lines = ["## Learned Experience Rules"];
  for (const rule of rules) {
    // Ensure consistent checklist format
    if (rule.startsWith("- ") || rule.startsWith("* ")) {
      lines.push(rule);
    } else {
      lines.push(`- ${rule}`);
    }
  }
  return lines.join("\n");
}

/**
 * assembleSystemPrompt({ playbook, specialty, skills, dna, experience }) → full prompt string
 *
 * playbook:   { body } from playbook-loader (required)
 * specialty:  { body } from specialty-loader (optional, can be null)
 * skills:     [{ name, description }] from skill-loader (optional, Claude Skills format)
 * dna:        object with 6 DNA dimensions (required)
 * experience: string digest of learned rules (optional, can be empty)
 */
export function assembleSystemPrompt({ playbook, specialty, skills, dna, experience }) {
  const layers = [];

  // Layer 1: Base Playbook
  if (playbook && playbook.body) {
    layers.push(playbook.body.trim());
  }

  // Layer 2: Specialty Addendum
  if (specialty && specialty.body) {
    layers.push(specialty.body.trim());
  }

  // Layer 3: Skill Definitions (Claude Skills format — name + description per skill)
  const skillsLayer = buildSkillsLayer(skills);
  if (skillsLayer) {
    layers.push(skillsLayer);
  }

  // Layer 4: DNA Style Layer
  const dnaLayer = buildDnaLayer(dna);
  if (dnaLayer) {
    layers.push(dnaLayer);
  }

  // Layer 5: Experience Addendum
  const expLayer = buildExperienceLayer(experience);
  if (expLayer) {
    layers.push(expLayer);
  }

  return layers.join(LAYER_SEPARATOR);
}

/**
 * validatePromptLayers({ playbook, specialty, skills, dna, experience }) → { valid, errors }
 */
export function validatePromptLayers({ playbook, specialty, skills, dna, experience }) {
  const errors = [];

  if (!playbook || !playbook.body) {
    errors.push("Layer 1 (playbook) is required and must have a body");
  }

  if (dna) {
    const present = DNA_DIMENSIONS.filter(d => dna[d]);
    if (present.length < 6) {
      const missing = DNA_DIMENSIONS.filter(d => !dna[d]);
      errors.push(`Layer 3 (DNA) missing dimensions: ${missing.join(", ")}`);
    }
  } else {
    errors.push("Layer 3 (DNA) is required");
  }

  // Layer 2 (specialty) and Layer 4 (experience) are optional — no validation errors

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * countLayers({ playbook, specialty, skills, dna, experience }) → number of active layers
 */
export function countLayers({ playbook, specialty, skills, dna, experience }) {
  let count = 0;
  if (playbook && playbook.body) count++;
  if (specialty && specialty.body) count++;
  if (Array.isArray(skills) && skills.length > 0) count++;
  if (dna && Object.values(dna).some(Boolean)) count++;
  if (experience && experience.trim()) count++;
  return count;
}
