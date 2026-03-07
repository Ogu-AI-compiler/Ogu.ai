/**
 * playbook-loader.mjs — Slice 380
 * Loads and parses markdown playbooks with YAML frontmatter + skills marker.
 * Playbook format:
 *   ---
 *   role: "QA Engineer"
 *   category: "quality"
 *   min_tier: 1
 *   capacity_units: 8
 *   ---
 *   # Body...
 *   <!-- skills: skill-a, skill-b -->
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

/**
 * Parse YAML frontmatter from markdown.
 * Simple parser — handles key: "value" and key: value lines.
 */
function parseFrontmatter(raw) {
  const fm = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^(\w[\w_]*)\s*:\s*(.+)/);
    if (m) {
      let val = m[2].trim();
      // Strip quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Numeric coercion for known fields
      if (["min_tier", "capacity_units"].includes(m[1])) {
        const num = Number(val);
        if (!isNaN(num)) val = num;
      }
      fm[m[1]] = val;
    }
  }
  return fm;
}

/**
 * Extract skills from <!-- skills: a, b, c --> marker in markdown.
 */
export function extractSkills(markdown) {
  if (typeof markdown !== "string") return [];
  const match = markdown.match(/<!--\s*skills:\s*(.+?)\s*-->/);
  if (!match) return [];
  return match[1].split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Extract named sections (## headings) from markdown body.
 */
function extractSections(body) {
  const sections = {};
  let currentHeading = null;
  let currentLines = [];

  for (const line of body.split("\n")) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (currentHeading) {
        sections[currentHeading] = currentLines.join("\n").trim();
      }
      currentHeading = headingMatch[1].trim();
      currentLines = [];
    } else if (currentHeading) {
      currentLines.push(line);
    }
  }
  if (currentHeading) {
    sections[currentHeading] = currentLines.join("\n").trim();
  }
  return sections;
}

/**
 * parsePlaybook(markdown) → { frontmatter, body, skills, sections }
 */
export function parsePlaybook(markdown) {
  if (typeof markdown !== "string") {
    throw new Error("parsePlaybook: expected string input");
  }

  let frontmatter = {};
  let body = markdown;

  // Extract YAML frontmatter
  const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (fmMatch) {
    frontmatter = parseFrontmatter(fmMatch[1]);
    body = fmMatch[2];
  }

  const skills = extractSkills(body);
  const sections = extractSections(body);

  return { frontmatter, body, skills, sections };
}

/**
 * loadPlaybook(path) → parsed playbook
 */
export function loadPlaybook(path) {
  if (!existsSync(path)) {
    throw new Error(`Playbook not found: ${path}`);
  }
  const content = readFileSync(path, "utf-8");
  const parsed = parsePlaybook(content);
  parsed.path = path;
  return parsed;
}

/**
 * Map from role slug to file location pattern.
 * role slug = lowercase-hyphenated version of the display name.
 */
export const ROLE_SLUG_MAP = {
  "product-manager":       "product/product-manager.md",
  "backend-architect":     "architecture/backend-architect.md",
  "frontend-developer":    "engineering/frontend-developer.md",
  "qa-engineer":           "quality/qa-engineer.md",
  "security-architect":    "security/security-architect.md",
  "devops-engineer":       "devops/devops-engineer.md",
  "scale-performance":     "expert/scale-performance.md",
  "tech-lead":             "engineering/tech-lead.md",
  "data-engineer":         "data/data-engineer.md",
  "ml-engineer":           "data/ml-engineer.md",
  "mobile-developer":      "engineering/mobile-developer.md",
  "api-designer":          "architecture/api-designer.md",
  "ux-researcher":         "product/ux-researcher.md",
  "ux-designer":           "product/ux-designer.md",
  "technical-writer":      "documentation/technical-writer.md",
  "release-manager":       "devops/release-manager.md",
  "site-reliability":      "devops/site-reliability.md",
  "database-admin":        "data/database-admin.md",
  "cloud-architect":       "architecture/cloud-architect.md",
  "platform-engineer":     "devops/platform-engineer.md",
  "full-stack-developer":  "engineering/full-stack-developer.md",
  "systems-programmer":    "engineering/systems-programmer.md",
  "compiler-engineer":     "engineering/compiler-engineer.md",
  "test-automation":       "quality/test-automation.md",
  "performance-tester":    "quality/performance-tester.md",
  "accessibility-expert":  "quality/accessibility-expert.md",
  "security-auditor":      "security/security-auditor.md",
  "penetration-tester":    "security/penetration-tester.md",
  "compliance-officer":    "security/compliance-officer.md",
  "devsecops-engineer":    "security/devsecops-engineer.md",
  "incident-commander":    "devops/incident-commander.md",
  "chaos-engineer":        "devops/chaos-engineer.md",
  "solutions-architect":   "architecture/solutions-architect.md",
  "domain-modeler":        "architecture/domain-modeler.md",
  "integration-architect": "architecture/integration-architect.md",
  "event-architect":       "architecture/event-architect.md",
  "product-analyst":       "product/product-analyst.md",
  "growth-engineer":       "product/growth-engineer.md",
  "developer-advocate":    "documentation/developer-advocate.md",
  "api-documentarian":     "documentation/api-documentarian.md",
  "data-scientist":        "data/data-scientist.md",
  "analytics-engineer":    "data/analytics-engineer.md",
  "etl-developer":         "data/etl-developer.md",
  "ai-engineer":           "expert/ai-engineer.md",
  "blockchain-developer":  "expert/blockchain-developer.md",
  "embedded-engineer":     "expert/embedded-engineer.md",
  "graphics-programmer":   "expert/graphics-programmer.md",
  "game-developer":        "expert/game-developer.md",
  "networking-engineer":   "expert/networking-engineer.md",
  "distributed-systems":   "expert/distributed-systems.md",
  "identity-engineer":     "security/identity-engineer.md",
  "cost-optimizer":        "devops/cost-optimizer.md",
  "observability-engineer":"devops/observability-engineer.md",
  "scrum-master":          "product/scrum-master.md",
  "program-manager":       "product/program-manager.md",
  "engineering-manager":   "product/engineering-manager.md",
  "cto":                   "expert/cto.md",
  "vp-engineering":        "expert/vp-engineering.md",
  "staff-engineer":        "expert/staff-engineer.md",
  "principal-engineer":    "expert/principal-engineer.md",
  "ui-developer":          "engineering/ui-developer.md",
  "backend-developer":     "engineering/backend-developer.md",
  "infra-engineer":        "devops/infra-engineer.md",
  "qa-lead":               "quality/qa-lead.md",
};

/**
 * loadPlaybookForRole(playbooksDir, roleSlug) → parsed playbook or null
 */
export function loadPlaybookForRole(playbooksDir, roleSlug) {
  const relative = ROLE_SLUG_MAP[roleSlug];
  if (relative) {
    const fullPath = join(playbooksDir, relative);
    if (existsSync(fullPath)) {
      return loadPlaybook(fullPath);
    }
  }

  // Fallback: search all .md files for matching frontmatter role slug
  try {
    const dirs = readdirSync(playbooksDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== "specialties");
    for (const dir of dirs) {
      const dirPath = join(playbooksDir, dir.name);
      const files = readdirSync(dirPath).filter(f => f.endsWith(".md"));
      for (const file of files) {
        if (file.replace(".md", "") === roleSlug) {
          return loadPlaybook(join(dirPath, file));
        }
      }
    }
  } catch { /* dir not found */ }

  return null;
}

/**
 * listAvailablePlaybooks(playbooksDir) → [{ roleSlug, category, path }]
 */
export function listAvailablePlaybooks(playbooksDir) {
  const results = [];
  if (!existsSync(playbooksDir)) return results;

  try {
    const dirs = readdirSync(playbooksDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== "specialties");

    for (const dir of dirs) {
      const dirPath = join(playbooksDir, dir.name);
      const files = readdirSync(dirPath).filter(f => f.endsWith(".md"));
      for (const file of files) {
        const roleSlug = file.replace(".md", "");
        results.push({
          roleSlug,
          category: dir.name,
          path: join(dirPath, file),
        });
      }
    }
  } catch { /* skip */ }

  return results;
}
