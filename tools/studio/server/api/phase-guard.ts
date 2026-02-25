/**
 * Phase Guard — server-side pipeline enforcement.
 * Inspects filesystem (not STATE.json) to determine actual phase,
 * and blocks messages that try to skip phases.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

/** Ordered pipeline phases */
export const PHASES = [
  "discovery",
  "feature",
  "architect",
  "preflight",
  "build",
  "gates",
  "deliver",
] as const;

export type Phase = (typeof PHASES)[number];

interface PhasePrerequisite {
  /** Files that MUST exist (relative to feature dir) to consider this phase complete */
  files: string[];
  /** Description shown when blocked */
  reason: string;
}

/** What must exist BEFORE entering each phase */
const PHASE_PREREQUISITES: Record<Phase, PhasePrerequisite> = {
  discovery: {
    files: [],
    reason: "Start by describing your idea.",
  },
  feature: {
    files: ["IDEA.md"],
    reason: "Discovery phase must complete first — IDEA.md is missing.",
  },
  architect: {
    files: ["IDEA.md", "PRD.md"],
    reason: "Product spec phase must complete first — PRD.md is missing.",
  },
  preflight: {
    files: ["IDEA.md", "PRD.md", "Spec.md", "Plan.json"],
    reason: "Architecture phase must complete first — Spec.md or Plan.json is missing.",
  },
  build: {
    files: ["IDEA.md", "PRD.md", "Spec.md", "Plan.json"],
    reason: "Preflight phase must complete first.",
  },
  gates: {
    files: ["IDEA.md", "PRD.md", "Spec.md", "Plan.json"],
    reason: "Build phase must complete first.",
  },
  deliver: {
    files: ["IDEA.md", "PRD.md", "Spec.md", "Plan.json"],
    reason: "Gates must pass before delivery.",
  },
};

/** Keywords that signal the user wants to jump to a specific phase */
const PHASE_INTENT_PATTERNS: { phase: Phase; patterns: RegExp[] }[] = [
  {
    phase: "build",
    patterns: [
      // English
      /\b(build|code|implement|develop|create|make)\b.*\b(app|site|page|feature|project|system|platform|tool|dashboard|website)\b/i,
      /\b(start|begin)\s+(building|coding|implementing|developing)/i,
      /\blet'?s?\s+(build|code|implement|make|create)\b/i,
      // Hebrew — תבנה, תיצור, תפתח, תכתוב קוד, תעשה לי אפליקציה
      /תבנ[הי]\s+(לי\s+)?(אפליקציה|אתר|דף|פרויקט|מערכת|פלטפורמה|כלי|דשבורד|אפ)/,
      /תיצור\s+(לי\s+)?(אפליקציה|אתר|דף|פרויקט|מערכת|פלטפורמה|כלי|דשבורד|אפ)/,
      /תפתח\s+(לי\s+)?(אפליקציה|אתר|דף|פרויקט|מערכת|פלטפורמה|כלי|דשבורד|אפ)/,
      /תעשה\s+(לי\s+)?(אפליקציה|אתר|דף|פרויקט|מערכת|פלטפורמה|כלי|דשבורד|אפ)/,
      /תכתוב\s+(לי\s+)?קוד/,
      /בוא\s+נבנה/,
      /בוא\s+נתחיל\s+(לבנות|לפתח|לקודד)/,
      /תתחיל\s+(לבנות|לפתח|לקודד|ליצור)/,
      // Arabic — ابني, أنشئ, طور
      /ابن[يِ]\s+(لي\s+)?(تطبيق|موقع|مشروع|نظام|منصة)/,
      /أنشئ\s+(لي\s+)?(تطبيق|موقع|مشروع|نظام|منصة)/,
    ],
  },
  {
    phase: "architect",
    patterns: [
      /\b(architect|design the system|plan the tech|technical spec)\b/i,
      /תתכנן\s+(את\s+)?ה(ארכיטקטורה|מערכת|טכנולוגיה)/,
    ],
  },
  {
    phase: "gates",
    patterns: [
      /\b(run gates|completion gate|verify|done)\b/i,
      /תריץ\s+gates/,
      /תבדוק\s+(שערים|gates)/,
    ],
  },
];

function readJsonSafe(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

/** Check if a file has real content beyond just template headers */
function hasRealContent(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    // Strip markdown headers, whitespace, HTML comments, empty list items
    const stripped = content
      .replace(/^#+ .+$/gm, "")           // headers
      .replace(/<!--.*?-->/gs, "")         // HTML comments
      .replace(/^-\s*\[\s*\]\s*$/gm, "")  // empty checkboxes
      .replace(/^\|.*\|$/gm, "")           // table rows (templates)
      .replace(/^\s*$/gm, "")             // blank lines
      .trim();
    return stripped.length > 20; // needs at least some real text
  } catch {
    return false;
  }
}

/** Detect the current phase by inspecting filesystem artifacts */
export function detectCurrentPhase(root: string, slug: string | null): Phase {
  if (!slug) return "discovery";

  const featureDir = join(root, "docs/vault/04_Features", slug);
  if (!existsSync(featureDir)) return "discovery";

  const has = (f: string) => existsSync(join(featureDir, f));
  const hasFilled = (f: string) => has(f) && hasRealContent(join(featureDir, f));

  // Check from most advanced phase backwards
  const metrics = readJsonSafe(join(featureDir, "METRICS.json"));
  if (metrics?.completed) return "deliver";

  const gateState = readJsonSafe(join(root, ".ogu/GATE_STATE.json"));
  if (gateState?.feature === slug && Object.keys(gateState.gates || {}).length > 0) return "gates";

  // Architect done = Spec.md filled (no TODO markers) + Plan.json has tasks
  if (has("Plan.json") && has("Spec.md")) {
    const spec = readFileSync(join(featureDir, "Spec.md"), "utf-8");
    const plan = readJsonSafe(join(featureDir, "Plan.json"));
    const specFilled = !spec.includes("<!-- TO BE FILLED BY /architect -->") && hasRealContent(join(featureDir, "Spec.md"));
    const planHasTasks = plan?.tasks?.length > 0;

    if (specFilled && planHasTasks) {
      // Check if preflight was done (doctor log or context lock exists)
      const contextLock = readJsonSafe(join(root, ".ogu/CONTEXT_LOCK.json"));
      if (contextLock) return "build";
      return "preflight";
    }
  }

  // Feature done = PRD.md has real content (not just template headers)
  if (hasFilled("PRD.md")) return "architect";

  // Discovery done = IDEA.md has real content
  if (hasFilled("IDEA.md")) return "feature";

  return "discovery";
}

/** Get the active feature slug from STATE.json */
export function getActiveSlug(root: string): string | null {
  const state = readJsonSafe(join(root, ".ogu/STATE.json"));
  return state?.current_task || null;
}

/** Get the involvement level from STATE.json */
export function getInvolvementLevel(root: string): string | null {
  const state = readJsonSafe(join(root, ".ogu/STATE.json"));
  return state?.involvement_level || null;
}

/** Detect what phase the user's message is trying to reach */
function detectIntendedPhase(message: string): Phase | null {
  for (const { phase, patterns } of PHASE_INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(message)) return phase;
    }
  }
  return null;
}

/** Check if all prerequisite files exist for a phase */
function checkPrerequisites(root: string, slug: string, phase: Phase): string[] {
  const prereqs = PHASE_PREREQUISITES[phase];
  const featureDir = join(root, "docs/vault/04_Features", slug);
  const missing: string[] = [];

  for (const file of prereqs.files) {
    if (!existsSync(join(featureDir, file))) {
      missing.push(file);
    }
  }

  return missing;
}

export interface PhaseGuardResult {
  allowed: boolean;
  currentPhase: Phase;
  intendedPhase: Phase | null;
  involvement: string | null;
  slug: string | null;
  /** If blocked, the reason */
  reason?: string;
  /** If blocked, which files are missing */
  missingFiles?: string[];
}

/**
 * Main guard function — call before spawning Claude.
 * Returns whether the message should be allowed through.
 */
export function guardPhase(root: string, message: string): PhaseGuardResult {
  const slug = getActiveSlug(root);
  const involvement = getInvolvementLevel(root);
  const currentPhase = detectCurrentPhase(root, slug);
  const intendedPhase = detectIntendedPhase(message);

  // No active feature — always allow through to discovery.
  // Users naturally say "let's build X" / "בוא נבנה" when describing their idea —
  // that's not skipping phases, it's starting discovery. The Discovery Hard Lock
  // prompt wrapping prevents Ogu from actually building.
  if (!slug) {
    return { allowed: true, currentPhase: "discovery", intendedPhase, involvement, slug };
  }

  // If user tries to jump ahead, check prerequisites
  if (intendedPhase) {
    const currentIdx = PHASES.indexOf(currentPhase);
    const intendedIdx = PHASES.indexOf(intendedPhase);

    if (intendedIdx > currentIdx + 1) {
      // Trying to skip phases
      const missing = checkPrerequisites(root, slug, intendedPhase);
      const nextPhase = PHASES[currentIdx + 1] || currentPhase;
      return {
        allowed: false,
        currentPhase,
        intendedPhase,
        involvement,
        slug,
        reason: PHASE_PREREQUISITES[intendedPhase].reason,
        missingFiles: missing.length > 0 ? missing : undefined,
      };
    }
  }

  // Check involvement level — must be set before advancing past discovery
  if (currentPhase === "discovery" && !involvement) {
    // Allow the message but the system prompt will enforce asking for involvement
    return { allowed: true, currentPhase, intendedPhase, involvement, slug };
  }

  return { allowed: true, currentPhase, intendedPhase, involvement, slug };
}

/** Allowed actions per phase — injected into system prompt */
export const PHASE_ACTIONS: Record<Phase, string[]> = {
  discovery: [
    "Ask product questions (one at a time)",
    "Ask about involvement level",
    "Ask about visual style / brand",
    "Run: feature:create, brand-scan, reference, theme",
    "Write IDEA.md when discovery is complete",
  ],
  feature: [
    "Write PRD.md, Spec.md (skeleton), QA.md",
    "Run: feature:validate --phase-1",
    "Run: brand-scan, reference, theme (still allowed until build)",
  ],
  architect: [
    "Fill Spec.md technical sections",
    "Create Plan.json with implementation tasks",
    "Run: graph, adr, contract:version, feature:validate --phase-2",
    "Run: brand-scan, reference, theme (still allowed until build)",
  ],
  preflight: [
    "Run: doctor, recall, context --feature <slug>",
    "Read and verify CONTEXT.md",
    "Report preflight status",
    "Run: brand-scan, reference, theme (last chance before build)",
  ],
  build: [
    "Implement tasks from Plan.json (in order)",
    "Read spec sections before each task",
    "Run: log after each task",
  ],
  gates: [
    "Run: gates run <slug>",
    "Fix failing gates",
    "Run: learn, remember --apply",
  ],
  deliver: [
    "Present summary of what was built",
    "Provide run instructions",
    "Ask about changes",
  ],
};
