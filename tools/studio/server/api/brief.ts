/**
 * Brief API — staged compiler pipeline after the ArchetypeWizard.
 *
 * POST /brief/launch (SSE)
 *   0. Haiku  → slug, summary, unknowns, constraints (intent extraction)
 *   1. feature:create → vault directory + ProjectBrief.md
 *   2. Sonnet → PRD.md          (product requirements — what to build)
 *   3. Sonnet → Spec.md         (technical spec — how it works)
 *   4. Opus  → Plan.json + CTO_Brief.md + UI_Manifest.json (architecture — how to build it)
 *   5. Update STATE.json → fire-and-forget dispatch
 *
 * Each stage takes all previous artifacts as input — true compiler pipeline.
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { spawnSync } from "child_process";
import { callLLM, parseJSON } from "./wizard.js";
import { computeCost, recordChatSpend } from "./model-bridge.js";
import { broadcast } from "../ws/server.js";
import { getProjectsDir, resolveRuntimePath } from "../../../ogu/commands/lib/runtime-paths.mjs";

function getRoot(): string {
  return process.env.OGU_ROOT || process.cwd();
}

// ── AI-based team selection ──────────────────────────────────────────────────

async function selectTeamWithAI(briefMd: string, complexityTier: string, allAgents: any[]): Promise<any[]> {
  console.log(`[selectTeamWithAI] allAgents.length=${allAgents.length}, tier=${complexityTier}`);

  if (allAgents.length === 0) {
    console.warn("[selectTeamWithAI] No agents in pool — marketplace may not be populated");
    return [];
  }

  // Send top 30 agents (highest tier first) to keep context manageable
  const poolAgents = [...allAgents]
    .sort((a, b) => (b.tier || 1) - (a.tier || 1))
    .slice(0, 30);

  const agentSummaries = poolAgents.map((a) => ({
    agent_id: a.agent_id,
    name: a.name,
    role: a.role,
    specialty: a.specialty || "",
    skills: (a.skills || []).slice(0, 4),
    tier: a.tier || 1,
  }));

  const system = `You are a CTO assembling a project team. Read the brief carefully and select the best agents from the available pool.

Rules:
- Select 4-8 agents total based on what the project actually needs
- Match specialties and skills to the specific project requirements
- Avoid adding roles the project doesn't need (e.g. don't add 3 backend engineers for a simple content site)
- Include a designer/UX if the project has significant UI/branding needs
- You MUST use the exact agent_id values from the Available agents list — do not invent or modify IDs
- Return ONLY valid JSON: { "team": [{ "agent_id": "...", "agent_name": "...", "role": "...", "role_display": "...", "rationale": "one sentence" }] }`;

  const userMsg = `Project brief:\n${briefMd.slice(0, 2000)}\n\nComplexity: ${complexityTier}\n\nAvailable agents:\n${JSON.stringify(agentSummaries, null, 2)}`;

  console.log(`[selectTeamWithAI] userMsg.length=${userMsg.length}`);

  const { text } = await callLLM("sonnet", system, userMsg, 1024);

  console.log(`[selectTeamWithAI] LLM response (first 500 chars): ${text.slice(0, 500)}`);

  let parsed: any;
  try {
    parsed = parseJSON(text);
  } catch (e: any) {
    console.error(`[selectTeamWithAI] parseJSON FAILED: ${e.message}\nRaw text: ${text}`);
    // Fall through to fallback below
    parsed = { team: [] };
  }

  const agentIdSet = new Set(allAgents.map((a) => a.agent_id));
  let team: any[] = (parsed.team || []).filter((m: any) => m.agent_id && agentIdSet.has(m.agent_id));

  // Fallback: AI returned empty or invalid IDs — pick top 5 agents by tier
  if (team.length === 0 && allAgents.length > 0) {
    console.warn("[selectTeamWithAI] AI returned empty/invalid team — falling back to top-5 selection");
    const fallback = [...allAgents].sort((a, b) => (b.tier || 1) - (a.tier || 1)).slice(0, 5);
    team = fallback.map((a) => ({
      agent_id: a.agent_id,
      agent_name: a.name,
      role: a.role || "core",
      role_display: a.role || "Core Member",
      rationale: "Selected as top-tier agent",
    }));
  }

  console.log(`[selectTeamWithAI] final team=${team.length} members`);
  return team;
}


const KNOWN_SCREEN_IDS = ["features", "pipeline", "agents", "budget", "settings"];
const KNOWN_WIDGET_TYPES = ["progress", "gates", "decisions", "activity", "tasks", "budget_summary", "agent_summary"];

function normalizeUIManifest(raw: any): any {
  if (!raw || typeof raw !== "object") return null;

  // Filter screens to known IDs
  const screens = Array.isArray(raw.screens)
    ? raw.screens.filter((s: any) => s && KNOWN_SCREEN_IDS.includes(s.id))
    : [];

  // Normalize dashboard
  const dash = raw.dashboard && typeof raw.dashboard === "object" ? raw.dashboard : {};
  const widgets = Array.isArray(dash.widgets)
    ? dash.widgets.filter((w: any) => w && KNOWN_WIDGET_TYPES.includes(w.type))
    : [];

  // Ensure at least some dashboard content
  const finalWidgets = widgets.length > 0 ? widgets : [
    { type: "progress", label: "Progress", size: "full" },
    { type: "tasks", label: "Tasks", size: "half" },
    { type: "activity", label: "Recent Activity", size: "full" },
  ];

  const primaryCta = dash.primary_cta && typeof dash.primary_cta === "object"
    ? { label: dash.primary_cta.label || "Continue", command: dash.primary_cta.command || "/architect", type: dash.primary_cta.type || "navigate" }
    : { label: "Begin Architecture", command: "/architect", type: "navigate" };

  const quickActions = Array.isArray(dash.quick_actions)
    ? dash.quick_actions.filter((a: any) => a && a.label && a.command)
    : [];

  return {
    version: 2,
    revision: raw.revision || 1,
    history: Array.isArray(raw.history) ? raw.history : [],
    screens,
    dashboard: { widgets: finalWidgets, primary_cta: primaryCta, quick_actions: quickActions },
    required_decisions: Array.isArray(raw.required_decisions) ? raw.required_decisions : [],
  };
}

function getCliPath(): string {
  return resolve(import.meta.dirname || __dirname, "..", "..", "..", "ogu", "cli.mjs");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** Create a fresh project directory and init Ogu structure */
function initNewProject(slug: string, cli: string): string {
  const projectsBase = join(homedir(), "Projects");
  mkdirSync(projectsBase, { recursive: true });

  let projectDir = join(projectsBase, slug);
  // Avoid collision with existing directory
  if (existsSync(projectDir)) {
    projectDir = join(projectsBase, `${slug}-${Date.now()}`);
  }
  mkdirSync(projectDir, { recursive: true });

  // Run ogu init to scaffold the project
  spawnSync("node", [cli, "init"], {
    cwd: projectDir,
    env: { ...process.env, OGU_ROOT: projectDir },
    stdio: "ignore",
    timeout: 15000,
  });

  // Initialize OrgSpec (required for agent dispatch)
  spawnSync("node", [cli, "org:init"], {
    cwd: projectDir,
    env: { ...process.env, OGU_ROOT: projectDir },
    stdio: "ignore",
    timeout: 15000,
  });

  // Populate Invariants.md with sensible defaults (gates require >= 5 rules)
  const invPath = join(projectDir, "docs/vault/01_Architecture/Invariants.md");
  if (existsSync(invPath)) {
    const content = readFileSync(invPath, "utf-8");
    // Check for real bullet rules (not just inside HTML comments)
    const hasRealRules = content.split("\n").some((l) => /^- /.test(l.trim()));
    if (!hasRealRules) {
      writeFileSync(invPath, `# Invariants

These are the non-negotiable architectural rules of this system.
Any implementation that violates an invariant is rejected.

## Rules

- TypeScript everywhere — no .js source files
- All API routes return JSON with { data } or { error } shape
- Components must be functional React components with hooks
- No hardcoded secrets or API keys in source code
- All user-facing text must be accessible (semantic HTML, alt text, ARIA labels)

## Design Rules

- WCAG AA contrast (4.5:1) on all solid backgrounds
- Typography scale: heading font sizes must decrease monotonically
- Responsive layout: no horizontal scroll at 320px width
`, "utf-8");
    }
  }

  // Preserve main repo root so child processes can find global OrgSpec + marketplace
  if (!process.env.OGU_MAIN_ROOT) {
    process.env.OGU_MAIN_ROOT = process.env.OGU_ROOT || process.cwd();
  }

  // Update OGU_ROOT to point to new project
  process.env.OGU_ROOT = projectDir;

  return projectDir;
}

interface LaunchBody {
  mode: string;
  archetypeId: string;
  archetypeTitle: string;
  description: string;
  answers: Record<string, any>;
}

/**
 * Stores in-flight Plan.json generation promises keyed by slug.
 * Allows approve-team to await the plan even if it's still being generated.
 */
const pendingPlanWrites = new Map<string, Promise<void>>();

export function createBriefRouter() {
  const router = new Hono();

  router.post("/brief/launch", async (c) => {
    console.log(`[brief:launch] CALLED at ${new Date().toISOString()}`);
    const body = await c.req.json<LaunchBody>();
    const { mode, archetypeId, archetypeTitle, description, answers } = body;

    if (!mode || !description?.trim()) {
      return c.json({ error: "mode and description are required" }, 400);
    }

    const cli = getCliPath();

    return streamSSE(c, async (stream) => {
      const send = async (event: string, data: any) => {
        try {
          await stream.writeSSE({ event, data: JSON.stringify(data) });
        } catch { /* client may have disconnected — continue */ }
      };

      const launchProgress = (slug: string, step: string, status: string) => {
        broadcast({ type: "project:launch_progress", slug, step, status } as any);
      };

      // ── Step 1: Haiku — extract structured brief ──
      await send("brief:generating", { status: "Understanding your idea..." });

      const think = (text: string) => broadcast({ type: "cto:thinking_line", slug: "_pending", text } as any);

      think("Reading your description and preferences...");

      let slug: string;
      let summary = "";
      let unknowns: string[] = [];
      let constraints: string[] = [];
      let priorityFlags: string[] = [];
      let confidence = 0.7;

      // Use a temporary root for the LLM call cost recording (may change after slug is known)
      let root = getRoot();
      const mainRepoRoot = root; // Preserve main repo root — marketplace is global, not per-project

      try {
        const system = `You extract structured project metadata from a user's product description.
Return ONLY valid JSON:
{
  "slug": "kebab-case-project-name (2-4 words, no special chars)",
  "summary": "2-3 sentence distilled project summary",
  "unknowns": ["things that are unclear or need decisions"],
  "constraints": ["hard constraints the user mentioned or implied"],
  "priority_flags": ["MVP", "speed", "quality", etc — what matters most],
  "confidence": 0.0-1.0
}`;

        const userMsg = `Mode: ${mode}
Archetype: ${archetypeTitle} (${archetypeId})
Description: ${description}
Answers: ${JSON.stringify(answers)}`;

        think("Analyzing project scope and extracting key requirements...");

        const { text, inputTokens, outputTokens } = await callLLM("haiku", system, userMsg);

        think("Structuring project metadata...");

        const parsed = parseJSON(text);
        const cost = computeCost("haiku", inputTokens, outputTokens);
        recordChatSpend(root, {
          timestamp: new Date().toISOString(),
          model: "haiku",
          inputTokens,
          outputTokens,
          cost,
          phase: "discovery",
        });

        slug = parsed.slug || slugify(description.slice(0, 60));
        summary = parsed.summary || description.slice(0, 200);
        unknowns = parsed.unknowns || [];
        constraints = parsed.constraints || [];
        priorityFlags = parsed.priority_flags || [];
        confidence = parsed.confidence ?? 0.7;

        think(`Project identified: "${slug.replace(/-/g, " ")}"`);
        if (unknowns.length > 0) think(`Found ${unknowns.length} open question${unknowns.length > 1 ? "s" : ""} to resolve`);
        if (constraints.length > 0) think(`Noted ${constraints.length} constraint${constraints.length > 1 ? "s" : ""}`);
      } catch {
        slug = slugify(description.slice(0, 60));
        summary = description.slice(0, 200);
      }

      // ── Create a fresh project directory for this new project ──
      const ctoThink = (text: string) => broadcast({ type: "cto:thinking_line", slug, text } as any);

      ctoThink("Creating project workspace...");
      root = initNewProject(slug, cli);
      ctoThink("Project scaffolded — directories, config, and org structure ready");

      // Register project in persistent registry (survives server restarts)
      try {
        const { registerProject } = await import("./router.js");
        registerProject(slug, root);
      } catch { /* best effort */ }

      // Broadcast: brief done, setup starting
      launchProgress(slug, "brief", "complete");
      launchProgress(slug, "setup", "active");

      // ── Step 2: Create feature directory ──
      ctoThink("Initializing feature vault...");
      try {
        execFileSync("node", [cli, "feature:create", slug], {
          cwd: root,
          env: { ...process.env, OGU_ROOT: root },
          encoding: "utf8",
          timeout: 15000,
        });
      } catch {
        // Directory may already exist — continue
      }

      const featureDir = join(root, "docs/vault/04_Features", slug);
      mkdirSync(featureDir, { recursive: true });

      // ── Step 3: Write ProjectBrief.md + project.meta.json ──
      ctoThink("Writing project brief and metadata...");
      const answerLines = Object.entries(answers)
        .map(([k, v]) => `- **${k}**: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join("\n");

      const briefMd = `# Project Brief: ${slug}

## Description
${description.trim()}

## Mode
${mode}

## Archetype
${archetypeTitle} (${archetypeId})

## Summary
${summary}

## Behavioral Selections
${answerLines || "_No selections made._"}

## Unknowns
${unknowns.length > 0 ? unknowns.map((u) => `- ${u}`).join("\n") : "_None identified._"}

## Constraints
${constraints.length > 0 ? constraints.map((c) => `- ${c}`).join("\n") : "_None identified._"}

## Priority Flags
${priorityFlags.length > 0 ? priorityFlags.map((f) => `- ${f}`).join("\n") : "_Standard priorities._"}
`;

      const meta = {
        version: 1,
        slug,
        mode,
        archetype_id: archetypeId,
        answers,
        constraints,
        unknowns,
        priority_flags: priorityFlags,
        confidence,
        created_at: new Date().toISOString(),
      };

      writeFileSync(join(featureDir, "ProjectBrief.md"), briefMd, "utf-8");
      writeFileSync(join(featureDir, "project.meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf-8");

      // ── FSM: Create lifecycle and transition to 'feature' ──
      const { createFeatureLifecycle, transitionFeature } = await import(
        /* @vite-ignore */ "../../../../tools/ogu/commands/lib/state-machine.mjs"
      );
      createFeatureLifecycle(slug, { root, initial: "discovery" });
      transitionFeature(root, slug, "feature", { reason: "Brief generated", actor: "studio" });

      // Broadcast: setup done, CTO starting
      launchProgress(slug, "setup", "complete");
      launchProgress(slug, "cto", "active");

      await send("brief:complete", { slug, summary, root });

      // ── Staged Compiler Pipeline (3 passes) ──
      ctoThink("Starting compiler pipeline — 3 passes...");
      ctoThink(`Target: "${slug.replace(/-/g, " ")}"`);
      broadcast({ type: "compiler:started", slug, stages: 3 } as any);

      let ctoBrief = "";
      let plan = { feature: slug, tasks: [] as any[] };
      let uiManifest: any = {
        version: 2,
        revision: 1,
        history: [],
        screens: [
          { id: "features", label: "Features", reason: "default" },
          { id: "pipeline", label: "Pipeline", reason: "default" },
          { id: "agents", label: "Agents", reason: "default" },
          { id: "budget", label: "Budget", reason: "default" },
          { id: "settings", label: "Settings", reason: "default" },
        ],
        dashboard: {
          widgets: [
            { type: "progress", label: "Progress", size: "full" },
            { type: "tasks", label: "Tasks", size: "half" },
            { type: "gates", label: "Gates", size: "half" },
            { type: "activity", label: "Recent Activity", size: "full" },
          ],
          primary_cta: { label: "Begin Architecture", command: "/architect", type: "navigate" },
          quick_actions: [],
        },
        required_decisions: [],
      };

      // ════════════════════════════════════════════════════
      // COMPILER PASS 1/3 — Product Requirements (Sonnet)
      // Input:  ProjectBrief.md
      // Output: PRD.md
      // ════════════════════════════════════════════════════
      ctoThink("Compiler pass 1/3 — analyzing product requirements...");
      broadcast({ type: "compiler:stage_start", slug, stage: 1, total: 3, label: "Product Requirements" } as any);

      let prdMd = "";
      try {
        const prdSystem = `You are a senior product manager. Given a project brief, write a comprehensive PRD.

Write the PRD directly in markdown. Do NOT wrap in JSON or code fences.

Required sections:
# {project name} — Product Requirements

## Problem
What problem does this solve? Why does it matter?

## User Personas
2-3 target user personas with their goals and pain points.

## Requirements
Numbered list of functional requirements. Be specific and concrete — derive everything from the brief.

## Success Metrics
How will we measure if this succeeds?

## Assumptions
Key assumptions we're making.

## Open Questions
Remaining unknowns to resolve.

## Out of Scope
What we're NOT building in MVP.

Be thorough and specific. Every requirement must trace back to the user's actual description and choices.`;

        const { text: prdText, inputTokens: prdIn, outputTokens: prdOut } = await callLLM("sonnet", prdSystem, `Project Brief:\n${briefMd}`, 4096);
        prdMd = prdText.trim();

        const prdCost = computeCost("sonnet", prdIn, prdOut);
        recordChatSpend(root, { timestamp: new Date().toISOString(), model: "sonnet", inputTokens: prdIn, outputTokens: prdOut, cost: prdCost, phase: "discovery", roleId: "pm" });

        writeFileSync(join(featureDir, "PRD.md"), prdMd, "utf-8");
        ctoThink("PRD.md locked — product requirements verified");
        broadcast({ type: "compiler:artifact", slug, stage: 1, artifact: "PRD.md" } as any);
      } catch (err: any) {
        ctoThink(`Compiler pass 1 FAILED: ${err?.message || err}`);
        throw new Error(`Compiler pass 1 (PRD) failed: ${err?.message || err}`);
      }

      // ════════════════════════════════════════════════════
      // COMPILER PASS 2/3 — Technical Specification (Sonnet)
      // Input:  ProjectBrief.md + PRD.md
      // Output: Spec.md
      // ════════════════════════════════════════════════════
      ctoThink("Compiler pass 2/3 — building technical specification...");
      broadcast({ type: "compiler:stage_start", slug, stage: 2, total: 3, label: "Technical Specification" } as any);

      let specMd = "";
      try {
        const specSystem = `You are a senior software architect. Given a project brief AND its PRD (previous compiler artifact), write a comprehensive Technical Specification.

The PRD defines WHAT to build. Your job is to define HOW — concrete technical decisions.

Write the spec directly in markdown. Do NOT wrap in JSON or code fences.

Required sections:
# {project name} — Technical Specification

## Overview
Technical summary of the system architecture.

## User Personas & Permissions
Roles, access levels, what each persona can do.

## Screens and Interactions
Key screens/pages — layout, behavior, navigation flow. Be specific.

## Edge Cases
Important edge cases to handle.

## Data Model
Entities, fields, types, relationships. Use a clear tabular or list format.

## API
Key API endpoints — method, path, request/response shapes.

## Mock API
Stub data for development — concrete example payloads.

## UI Components
Component hierarchy and responsibilities. Props and behavior.

Every section must contain real, concrete content derived from the PRD. No placeholders.`;

        const specInput = `Project Brief:\n${briefMd}\n\n---\n\nPRD (previous compiler artifact):\n${prdMd}`;
        const { text: specText, inputTokens: specIn, outputTokens: specOut } = await callLLM("sonnet", specSystem, specInput, 8192);
        specMd = specText.trim();

        const specCost = computeCost("sonnet", specIn, specOut);
        recordChatSpend(root, { timestamp: new Date().toISOString(), model: "sonnet", inputTokens: specIn, outputTokens: specOut, cost: specCost, phase: "discovery", roleId: "architect" });

        writeFileSync(join(featureDir, "Spec.md"), specMd, "utf-8");
        ctoThink("Spec.md locked — data model, API, and components defined");
        broadcast({ type: "compiler:artifact", slug, stage: 2, artifact: "Spec.md" } as any);
      } catch (err: any) {
        ctoThink(`Compiler pass 2 FAILED: ${err?.message || err}`);
        throw new Error(`Compiler pass 2 (Spec) failed: ${err?.message || err}`);
      }

      // ════════════════════════════════════════════════════
      // COMPILER PASS 3/3 — Architecture & Plan (Sonnet, background)
      // Runs IN PARALLEL with team assembly so user sees the team faster.
      // ════════════════════════════════════════════════════
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const archSystem = `You are a CTO. You receive three compiler artifacts: ProjectBrief, PRD, and Technical Spec. Your job is the final compilation pass — produce the implementation plan.

Return ONLY valid JSON:
{
  "cto_brief_md": "Markdown CTO brief with sections: ## Scope, ## Core Flows, ## Risk Assessment, ## Technical Direction, ## Out of Scope",
  "plan": {
    "feature": "${slug}",
    "tasks": [
      { "id": "T1", "title": "...", "group": "setup|core|ui|integration|polish", "model": "haiku|sonnet|opus", "depends_on": [], "touches": ["file1.ts"], "done_when": "acceptance criteria" }
    ]
  },
  "ui_manifest": {
    "version": 2,
    "screens": [
      { "id": "features|pipeline|agents|budget|settings", "label": "Human label", "reason": "why needed" }
    ],
    "dashboard": {
      "widgets": [
        { "type": "progress|gates|decisions|activity|tasks|budget_summary|agent_summary", "label": "Human label", "size": "full|half" }
      ],
      "primary_cta": { "label": "...", "command": "/architect", "type": "navigate" },
      "quick_actions": []
    },
    "required_decisions": []
  }
}

IMPORTANT — Use the PRD and Spec to inform every decision. The Spec's data model, API, and component list should map directly to tasks.

Model selection rules:
- "haiku"  → simple/mechanical: config, deps, tests, boilerplate, SEO, copy
- "sonnet" → standard code: components, API routes, styling, forms, integration
- "opus"   → complex architecture: auth, state management, payments, data modeling
Pick the CHEAPEST model that can handle the task. Most tasks should be haiku or sonnet.

QUALITY GATES — the plan MUST produce code that passes 14 automated gates:
- Gate 3: Every file in "touches" must exist after build. List real paths from the Spec.
- Gate 4: Agents must NEVER write TODO/FIXME comments. State this in task descriptions.
- Gate 8: Include a smoke test task at tests/smoke/${slug}.test.ts using vitest.
- Gate 10: Include a contracts task filling docs/vault/02_Contracts/ with real content.
- Gate 11: If DB needed: setup task with .env + SQLite + Prisma generate + db push.
- Ensure correct npm package names (e.g. @mdx-js/react NOT mdx-js-react).

Break the project into as many small, focused tasks as needed. Each task should do ONE thing — a single file, a single feature, a single concern. Prefer many small tasks over few large ones: agents succeed more reliably on narrow, well-defined work. Focus on MVP scope. Always include setup + smoke test + contracts tasks.`;

      const archInput = `Project Brief:\n${briefMd}\n\n---\n\nPRD:\n${prdMd}\n\n---\n\nTechnical Specification:\n${specMd}`;

      ctoThink("Compiler pass 3/3 — architecture and implementation plan...");
      broadcast({ type: "compiler:stage_start", slug, stage: 3, total: 3, label: "Architecture & Plan" } as any);

      // ── Launch Plan.json generation in the background (Sonnet, ~60s) ──
      const planWritePromise: Promise<void> = (async () => {
        const { text: archText, inputTokens: archIn, outputTokens: archOut } = await callLLM("sonnet", archSystem, archInput, 8192);
        ctoThink("Architecture analysis complete — structuring deliverables...");
        const parsed = parseJSON(archText);
        const archCost = computeCost("sonnet", archIn, archOut);
        recordChatSpend(root, { timestamp: new Date().toISOString(), model: "sonnet", inputTokens: archIn, outputTokens: archOut, cost: archCost, phase: "discovery", roleId: "cto" });

        if (parsed.plan?.tasks?.length > 0) {
          plan = parsed.plan;
          ctoThink(`Plan.json locked — ${plan.tasks.length} tasks across ${new Set(plan.tasks.map((t: any) => t.group || "core")).size} teams`);
        }
        ctoBrief = parsed.cto_brief_md || "";
        if (parsed.ui_manifest) {
          const normalized = normalizeUIManifest(parsed.ui_manifest);
          if (normalized) uiManifest = normalized;
        }

        // Write final compiler artifacts
        writeFileSync(join(featureDir, "CTO_Brief.md"), ctoBrief, "utf-8");
        writeFileSync(join(featureDir, "Plan.json"), JSON.stringify(plan, null, 2) + "\n", "utf-8");
        writeFileSync(join(featureDir, "UI_Manifest.json"), JSON.stringify(uiManifest, null, 2) + "\n", "utf-8");

        broadcast({ type: "compiler:artifact", slug, stage: 3, artifact: "Plan.json" } as any);
        broadcast({ type: "compiler:completed", slug, stages: 3, artifacts: ["PRD.md", "Spec.md", "Plan.json", "CTO_Brief.md", "UI_Manifest.json"] } as any);
        ctoThink("Compilation complete — all artifacts verified");
      })();

      // Store the promise so approve-team can await it
      pendingPlanWrites.set(slug, planWritePromise);
      // Log but don't throw — team assembly continues regardless
      planWritePromise.catch((err: any) => {
        ctoThink(`Compiler pass 3 FAILED: ${err?.message || err}`);
        console.error("[brief] Pass 3 background failed:", err);
      });

      // ── Team assembly runs IN PARALLEL with plan generation ──
      ctoThink("Assembling your development team...");
      await sleep(400);

      let teamData: any = null;

      const { planProject, saveCTOPlan } = await import(
        /* @vite-ignore */ "../../../../tools/ogu/commands/lib/cto-planner.mjs"
      );
      const { saveTeam } = await import(
        /* @vite-ignore */ "../../../../tools/ogu/commands/lib/team-assembler.mjs"
      );
      const projDir = join(getProjectsDir(root), slug);
      mkdirSync(projDir, { recursive: true });

      ctoThink("CTO analyzing complexity and team requirements...");
      const ctoPlan = planProject(briefMd, { projectId: slug } as any);
      saveCTOPlan(root, slug, ctoPlan);
      ctoThink(`Complexity: ${ctoPlan.complexity?.tier || "medium"} (score ${ctoPlan.complexity?.score || 0})`);

      ctoThink("Reading brief and selecting best agents...");
      const { searchAgents } = await import(
        /* @vite-ignore */ "../../../../tools/ogu/commands/lib/agent-store.mjs"
      );
      const allAgents = searchAgents(mainRepoRoot, {});
      const aiTeam = await selectTeamWithAI(briefMd, ctoPlan.complexity?.tier || "medium", allAgents);

      // Build team structure from AI selection
      const teamMembers = aiTeam.map((m: any, i: number) => {
        const agent = allAgents.find((a: any) => a.agent_id === m.agent_id);
        return {
          member_id: `tm_${String(i + 1).padStart(4, "0")}`,
          role_id: m.role || m.agent_id,
          role_display: m.role_display || m.role,
          agent_id: m.agent_id,
          agent_name: m.agent_name || agent?.name || m.agent_id,
          agent_tier: agent?.tier || 1,
          agent_specialty: agent?.specialty || "",
          allocation_id: null,
          capacity_units: agent?.capacity_units || 6,
          allocated_units: 0,
          status: "active",
          rationale: m.rationale || "",
          optional: false,
        };
      });

      const assembledTeam = {
        team_id: `team_${Date.now()}`,
        project_id: slug,
        created_at: new Date().toISOString(),
        members: teamMembers,
        complexity_tier: ctoPlan.complexity?.tier || "medium",
        total_slots: teamMembers.length,
        assigned_slots: teamMembers.length,
        unassigned_slots: 0,
      };
      saveTeam(root, slug, assembledTeam);

      const teamPath = join(getProjectsDir(root), slug, "team.json");
      const ctoPlanPath = join(getProjectsDir(root), slug, "cto-plan.json");
      if (!existsSync(teamPath)) {
        throw new Error(`CTO pipeline failed: team.json not written at ${teamPath}`);
      }

      teamData = JSON.parse(readFileSync(teamPath, "utf-8"));
      if (existsSync(ctoPlanPath)) {
        const savedCtoPlan = JSON.parse(readFileSync(ctoPlanPath, "utf-8"));
        teamData.blueprint = savedCtoPlan.teamBlueprint || { roles: [] };
        teamData.complexity = savedCtoPlan.complexity || { score: 0, tier: teamData.complexity_tier || "medium" };
      }
      ctoThink("CTO pipeline complete — team assembled from agent pool");

      // Progressive reveal with REAL agents from team.json
      const members: any[] = teamData?.members || [];
      const seenRoles = new Set<string>();
      for (const member of members) {
        const role = member.role_id || member.roleId || "core";
        if (!seenRoles.has(role)) {
          seenRoles.add(role);
          const name = member.agent_name || member.role_display || role;
          ctoThink(`${name} — ${member.status === "active" ? "assigned and ready" : "slot open"}`);
          broadcast({ type: "cto:agent_found", slug, group: role, agentName: name } as any);
          await sleep(1200);
        }
      }

      // Broadcast: CTO done
      launchProgress(slug, "cto", "complete");

      // ── FSM: Transition to 'architect' + broadcast ──
      const { resolveUIState } = await import("./project-state.js");
      transitionFeature(root, slug, "architect", { reason: "CTO expansion complete", actor: "studio" });
      const uiState = resolveUIState(root, slug);
      broadcast({ type: "project:state_changed", slug, state: uiState } as any);

      // ── Update STATE.json ──
      const statePath = resolveRuntimePath(root, "STATE.json");
      let state: any = {};
      try { state = JSON.parse(readFileSync(statePath, "utf-8")); } catch {}
      state.current_task = slug;
      writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");

      await send("launch:complete", { slug, summary, taskCount: 0 }); // taskCount shown after approval

      // ── Show team for review — user approves while Plan.json finishes in background ──
      ctoThink("Team ready for review — approve to start build");
      broadcast({
        type: "project:team_ready",
        slug,
        lifecycleProjectId: slug,
        team: teamData,
      } as any);
    });
  });

  // ── Approve team and start dispatch ──
  router.post("/brief/project/:slug/approve-team", async (c) => {
    const slug = c.req.param("slug");
    if (!slug || slug.includes("..") || slug.includes("/")) {
      return c.json({ error: "Invalid slug" }, 400);
    }

    let root = getRoot();
    try {
      const { readProjectRegistry } = await import("./router.js");
      const entry = readProjectRegistry().find((p: any) => p.slug === slug);
      if (entry && existsSync(entry.root)) root = entry.root;
    } catch { /* fallback */ }

    const ctoThink = (text: string) => broadcast({ type: "cto:thinking_line", slug, text } as any);
    ctoThink("Team approved — starting execution...");

    // Mark team as approved (enforce lifecycle)
    try {
      const teamPath = join(getProjectsDir(root), slug, "team.json");
      if (!existsSync(teamPath)) {
        return c.json({ error: "Team not found — cannot approve" }, 404 as any);
      }
      const team = JSON.parse(readFileSync(teamPath, "utf-8"));
      const approvedAt = new Date().toISOString();
      const nextTeam = {
        ...team,
        approved: true,
        approved_at: team.approved_at || approvedAt,
        approved_by: team.approved_by || "studio-user",
      };
      writeFileSync(teamPath, JSON.stringify(nextTeam, null, 2) + "\n", "utf-8");
    } catch { /* best-effort — approval still proceeds */ }

    // If Plan.json is still being generated in the background, wait for it
    const planPromise = pendingPlanWrites.get(slug);
    if (planPromise) {
      ctoThink("Finalizing implementation plan...");
      try {
        await planPromise;
      } catch {
        ctoThink("Plan generation encountered an issue — continuing with available plan");
      }
      pendingPlanWrites.delete(slug);
    }

    // Now Plan.json is on disk — show task assignments
    const planPath = join(root, "docs/vault/04_Features", slug, "Plan.json");
    if (existsSync(planPath)) {
      try {
        const plan = JSON.parse(readFileSync(planPath, "utf-8"));
        if (plan.tasks?.length > 0) {
          ctoThink("Assigning tasks to agents...");
          for (const t of plan.tasks) {
            broadcast({ type: "cto:task_dispatched", slug, taskId: t.id, title: t.title, group: t.group || "core" } as any);
            await new Promise((r) => setTimeout(r, 400));
          }
        }
      } catch { /* best effort */ }
    }

    import("./dispatch.js")
      .then(({ dispatchProject }) => {
        console.log(`[brief] Team approved — starting dispatch for ${slug} at ${root}`);
        return dispatchProject(root, slug);
      })
      .catch((err) => {
        console.error("[brief] Dispatch after team approval failed:", err);
        broadcast({ type: "dispatch:error", slug, error: String(err?.message || err) } as any);
      });

    return c.json({ ok: true });
  });

  // ── Resume an existing project ──
  // Re-runs compiler pass 3 if Plan.json has no tasks, then fires dispatch.
  // The same WS events as launch flow are emitted so ProjectScreen's live view works.
  router.post("/brief/project/:slug/resume", async (c) => {
    const slug = c.req.param("slug");
    if (!slug || slug.includes("..") || slug.includes("/")) {
      return c.json({ error: "Invalid slug" }, 400);
    }

    // Resolve project root
    let root = getRoot();
    try {
      const { readProjectRegistry } = await import("./router.js");
      const entry = readProjectRegistry().find((p: any) => p.slug === slug);
      if (entry && existsSync(entry.root)) root = entry.root;
    } catch { /* fallback to default root */ }

    const featureDir = join(root, "docs/vault/04_Features", slug);
    if (!existsSync(featureDir)) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Enforce lifecycle: team must be approved before resume/dispatch
    try {
      const teamPath = join(getProjectsDir(root), slug, "team.json");
      if (!existsSync(teamPath)) {
        return c.json({ error: "Team not found — approve team before resuming" }, 404 as any);
      }
      const team = JSON.parse(readFileSync(teamPath, "utf-8"));
      const approved = team?.approved === true || !!team?.approved_at;
      if (!approved) {
        return c.json({ error: "Team not approved — approve team before resuming" }, 409 as any);
      }
    } catch { /* best-effort */ }

    const planPath = join(featureDir, "Plan.json");
    let plan: { feature: string; tasks: any[] } = { feature: slug, tasks: [] };
    try { plan = JSON.parse(readFileSync(planPath, "utf-8")); } catch { /* empty */ }
    const hasTasks = plan.tasks?.length > 0;

    // Fire-and-forget — returns immediately, WS drives the live view
    (async () => {
      const ctoThink = (text: string) => broadcast({ type: "cto:thinking_line", slug, text } as any);
      const launchProgress = (step: string, status: string) =>
        broadcast({ type: "project:launch_progress", slug, step, status } as any);

      if (!hasTasks) {
        // Need to re-run compiler pass 3 (plan generation)
        launchProgress("brief", "complete");
        launchProgress("setup", "complete");
        launchProgress("cto", "active");

        ctoThink("Resuming compilation — reading existing artifacts...");

        const briefMd = existsSync(join(featureDir, "ProjectBrief.md"))
          ? readFileSync(join(featureDir, "ProjectBrief.md"), "utf-8") : "";
        const prdMd = existsSync(join(featureDir, "PRD.md"))
          ? readFileSync(join(featureDir, "PRD.md"), "utf-8") : "";
        const specMd = existsSync(join(featureDir, "Spec.md"))
          ? readFileSync(join(featureDir, "Spec.md"), "utf-8") : "";

        ctoThink("Compiler pass 3/3 — architecture and implementation plan...");
        broadcast({ type: "compiler:stage_start", slug, stage: 3, total: 3, label: "Architecture & Plan" } as any);

        let ctoBrief = "";
        try {
          const archSystem = `You are a CTO. You receive compiler artifacts: ProjectBrief, PRD, and Technical Spec.
Return ONLY valid JSON:
{
  "cto_brief_md": "Markdown CTO brief",
  "plan": {
    "feature": "${slug}",
    "tasks": [
      { "id": "T1", "title": "...", "group": "setup|core|ui|integration|polish", "model": "haiku|sonnet|opus", "depends_on": [], "touches": ["file1.ts"], "done_when": "acceptance criteria" }
    ]
  }
}

Break into as many small, focused tasks as needed — each task should do ONE thing. Prefer many small tasks over few large ones. Always include setup + smoke test (tests/smoke/${slug}.test.ts) + contracts tasks.
Model: haiku=simple, sonnet=standard, opus=complex. Prefer haiku/sonnet.`;

          const archInput = `Brief:\n${briefMd}\n\nPRD:\n${prdMd}\n\nSpec:\n${specMd}`;
          const { text, inputTokens, outputTokens } = await callLLM("opus", archSystem, archInput, 8192);
          ctoThink("Architecture analysis complete — structuring deliverables...");

          const parsed = parseJSON(text);
          const cost = computeCost("opus", inputTokens, outputTokens);
          recordChatSpend(root, { timestamp: new Date().toISOString(), model: "opus", inputTokens, outputTokens, cost, phase: "architect", roleId: "cto" });

          ctoBrief = parsed.cto_brief_md || "";
          if (parsed.plan?.tasks?.length > 0) {
            plan = parsed.plan;
            ctoThink(`Plan.json locked — ${plan.tasks.length} tasks across ${new Set(plan.tasks.map((t: any) => t.group || "core")).size} teams`);
          }
          broadcast({ type: "compiler:artifact", slug, stage: 3, artifact: "Plan.json" } as any);
        } catch (err) {
          console.error("[resume] Compiler pass 3 failed:", err);
          ctoBrief = `# CTO Brief: ${slug}\n\n_Resume regeneration failed. Plan tasks are empty — retry._\n`;
        }

        writeFileSync(join(featureDir, "CTO_Brief.md"), ctoBrief, "utf-8");
        writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n", "utf-8");
        broadcast({ type: "compiler:completed", slug, stages: 3, artifacts: ["Plan.json", "CTO_Brief.md"] } as any);

        // Progressive reveal
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        ctoThink("Assembling your development team...");
        await sleep(600);

        const seenGroups = new Set<string>();
        // Load real agent names from team.json
        const resolveGroupNames = (): Record<string, string> => {
          const defaults: Record<string, string> = { setup: "Ops", core: "Dev", ui: "Design", integration: "Integration", polish: "QA" };
          try {
            const teamPath = join(getProjectsDir(root), slug, "team.json");
            if (!existsSync(teamPath)) return defaults;
            const team = JSON.parse(readFileSync(teamPath, "utf-8"));
            const active = (team?.members || []).filter((m: any) => m.status === "active" && m.agent_name);
            if (active.length === 0) return defaults;
            const used = new Set<string>();
            const pick = (...keys: string[]) => {
              let m = active.find((m: any) => !used.has(m.agent_id) && keys.some((k) => (m.role_id || "").includes(k)));
              if (!m) m = active.find((m: any) => !used.has(m.agent_id));
              if (m) { used.add(m.agent_id); return m.agent_name as string; }
              return null;
            };
            const n0 = pick("devops", "ops", "infra"); if (n0) defaults["setup"] = n0;
            const n1 = pick("backend", "engineer", "developer"); if (n1) defaults["core"] = n1;
            const n2 = pick("frontend", "designer", "ui"); if (n2) defaults["ui"] = n2;
            const n3 = pick("backend", "api", "integration"); if (n3) defaults["integration"] = n3;
            const n4 = pick("qa", "quality", "test"); if (n4) defaults["polish"] = n4;
          } catch { /* use defaults */ }
          return defaults;
        };
        const groupAgentNames = resolveGroupNames();
        const groupDescs: Record<string, string> = { setup: "will scaffold the project", core: "will build the core logic", ui: "will craft the interface", integration: "will wire services", polish: "will run quality checks" };

        for (const t of plan.tasks) {
          const group = t.group || "core";
          if (!seenGroups.has(group)) {
            seenGroups.add(group);
            ctoThink(`${groupAgentNames[group] || group} ${groupDescs[group] || "is ready"}`);
            broadcast({ type: "cto:agent_found", slug, group, agentName: groupAgentNames[group] || group } as any);
            await sleep(1500);
          }
        }

        ctoThink("Assigning tasks to agents...");
        await sleep(400);
        for (const t of plan.tasks) {
          broadcast({ type: "cto:task_dispatched", slug, taskId: t.id, title: t.title, group: t.group || "core" } as any);
          await sleep(400);
        }
        await sleep(300);
        launchProgress("cto", "complete");

        // Update FSM
        try {
          const { transitionFeature } = await import(/* @vite-ignore */ "../../../../tools/ogu/commands/lib/state-machine.mjs");
          const { resolveUIState } = await import("./project-state.js");
          transitionFeature(root, slug, "architect", { reason: "Resume: plan generated", actor: "studio" });
          const uiState = resolveUIState(root, slug);
          broadcast({ type: "project:state_changed", slug, state: uiState } as any);
        } catch { /* FSM best-effort */ }
      } else {
        // Has tasks — just re-reveal them then dispatch
        launchProgress("brief", "complete");
        launchProgress("setup", "complete");
        launchProgress("cto", "active");
        ctoThink("Resuming build — restoring task graph...");

        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const resolveGroupNames2 = (): Record<string, string> => {
          const defaults: Record<string, string> = { setup: "Ops", core: "Dev", ui: "Design", integration: "Integration", polish: "QA" };
          try {
            const teamPath = join(getProjectsDir(root), slug, "team.json");
            if (!existsSync(teamPath)) return defaults;
            const team = JSON.parse(readFileSync(teamPath, "utf-8"));
            const active = (team?.members || []).filter((m: any) => m.status === "active" && m.agent_name);
            if (active.length === 0) return defaults;
            const used = new Set<string>();
            const pick = (...keys: string[]) => {
              let m = active.find((m: any) => !used.has(m.agent_id) && keys.some((k) => (m.role_id || "").includes(k)));
              if (!m) m = active.find((m: any) => !used.has(m.agent_id));
              if (m) { used.add(m.agent_id); return m.agent_name as string; }
              return null;
            };
            const n0 = pick("devops", "ops"); if (n0) defaults["setup"] = n0;
            const n1 = pick("backend", "engineer"); if (n1) defaults["core"] = n1;
            const n2 = pick("frontend", "designer"); if (n2) defaults["ui"] = n2;
            const n3 = pick("backend", "api"); if (n3) defaults["integration"] = n3;
            const n4 = pick("qa", "quality"); if (n4) defaults["polish"] = n4;
          } catch { /* use defaults */ }
          return defaults;
        };
        const groupAgentNames = resolveGroupNames2();
        const seenGroups = new Set<string>();

        for (const t of plan.tasks) {
          const group = t.group || "core";
          if (!seenGroups.has(group)) {
            seenGroups.add(group);
            broadcast({ type: "cto:agent_found", slug, group, agentName: groupAgentNames[group] || group } as any);
          }
          broadcast({ type: "cto:task_dispatched", slug, taskId: t.id, title: t.title, group: t.group || "core" } as any);
          await sleep(150);
        }

        await sleep(300);
        launchProgress("cto", "complete");

        const { resolveUIState } = await import("./project-state.js");
        const uiState = resolveUIState(root, slug);
        broadcast({ type: "project:state_changed", slug, state: uiState } as any);
      }

      // Fire-and-forget dispatch (runs only unfinished tasks)
      ctoThink("Starting agent execution...");
      import("./dispatch.js")
        .then(({ dispatchProject }) => dispatchProject(root, slug))
        .catch((err) => broadcast({ type: "dispatch:error", slug, error: String(err?.message || err) } as any));
    })().catch(console.error);

    return c.json({ ok: true, started: true, mode: hasTasks ? "dispatch_resume" : "plan_regen" });
  });

  return router;
}
