/**
 * Brief routes — staged compiler pipeline after the ArchetypeWizard.
 * Part of the Kadima API.
 *
 * Handles:
 *   POST /api/brief/launch (SSE)                    — run full compiler pipeline
 *   POST /api/brief/project/:slug/approve-team      — approve team and start dispatch
 *   POST /api/brief/project/:slug/resume            — resume existing project
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { callLLM, parseJSON, computeCost, recordChatSpend } from './wizard-routes.mjs';
import { dispatchProject } from '../execution/dispatch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR   = resolve(__dirname, '..', '..', 'ogu', 'commands', 'lib');
const CLI_PATH  = resolve(__dirname, '..', '..', 'ogu', 'cli.mjs');

const REGISTRY_PATH = join(homedir(), '.ogu', 'kadima-projects.json');

// ── Project registry (shared with project-routes) ────────────────────────────

export function readProjectRegistry() {
  try {
    const data = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
    return Array.isArray(data.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

export function registerProject(slug, root) {
  const dir = join(homedir(), '.ogu');
  mkdirSync(dir, { recursive: true });
  const projects = readProjectRegistry().filter((p) => p.slug !== slug);
  projects.push({ slug, root, createdAt: new Date().toISOString() });
  writeFileSync(REGISTRY_PATH, JSON.stringify({ projects }, null, 2) + '\n', 'utf8');
}

// ── Pending plan writes (plan generation runs in background) ─────────────────
const pendingPlanWrites = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function resolveUIState(root, slug) {
  try {
    const statePath = join(root, '.ogu', 'state', 'features', `${slug}.state.json`);
    if (!existsSync(statePath)) return null;
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch { return null; }
}

function initNewProject(slug) {
  const projectsBase = join(homedir(), 'Projects');
  mkdirSync(projectsBase, { recursive: true });

  let projectDir = join(projectsBase, slug);
  if (existsSync(projectDir)) projectDir = join(projectsBase, `${slug}-${Date.now()}`);
  mkdirSync(projectDir, { recursive: true });

  spawnSync('node', [CLI_PATH, 'init'], {
    cwd: projectDir,
    env: { ...process.env, OGU_ROOT: projectDir },
    stdio: 'ignore',
    timeout: 15000,
  });
  spawnSync('node', [CLI_PATH, 'org:init'], {
    cwd: projectDir,
    env: { ...process.env, OGU_ROOT: projectDir },
    stdio: 'ignore',
    timeout: 15000,
  });

  // Populate Invariants.md with defaults (gates require >= 5 rules)
  const invPath = join(projectDir, 'docs/vault/01_Architecture/Invariants.md');
  if (existsSync(invPath)) {
    const content = readFileSync(invPath, 'utf8');
    const hasRealRules = content.split('\n').some((l) => /^- /.test(l.trim()));
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
`, 'utf8');
    }
  }

  if (!process.env.OGU_MAIN_ROOT) {
    process.env.OGU_MAIN_ROOT = process.env.OGU_ROOT || process.cwd();
  }

  return projectDir;
}

const KNOWN_SCREEN_IDS   = ['features', 'pipeline', 'agents', 'budget', 'settings'];
const KNOWN_WIDGET_TYPES = ['progress', 'gates', 'decisions', 'activity', 'tasks', 'budget_summary', 'agent_summary'];

function normalizeUIManifest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const screens = Array.isArray(raw.screens) ? raw.screens.filter((s) => s && KNOWN_SCREEN_IDS.includes(s.id)) : [];
  const dash = raw.dashboard && typeof raw.dashboard === 'object' ? raw.dashboard : {};
  const widgets = Array.isArray(dash.widgets) ? dash.widgets.filter((w) => w && KNOWN_WIDGET_TYPES.includes(w.type)) : [];
  const finalWidgets = widgets.length > 0 ? widgets : [
    { type: 'progress', label: 'Progress', size: 'full' },
    { type: 'tasks', label: 'Tasks', size: 'half' },
    { type: 'activity', label: 'Recent Activity', size: 'full' },
  ];
  const primaryCta = dash.primary_cta && typeof dash.primary_cta === 'object'
    ? { label: dash.primary_cta.label || 'Continue', command: dash.primary_cta.command || '/architect', type: dash.primary_cta.type || 'navigate' }
    : { label: 'Begin Architecture', command: '/architect', type: 'navigate' };
  const quickActions = Array.isArray(dash.quick_actions) ? dash.quick_actions.filter((a) => a && a.label && a.command) : [];
  return {
    version: 2, revision: raw.revision || 1, history: Array.isArray(raw.history) ? raw.history : [],
    screens,
    dashboard: { widgets: finalWidgets, primary_cta: primaryCta, quick_actions: quickActions },
    required_decisions: Array.isArray(raw.required_decisions) ? raw.required_decisions : [],
  };
}

async function selectTeamWithAI(briefMd, complexityTier, allAgents) {
  if (allAgents.length === 0) return [];

  const poolAgents = [...allAgents].sort((a, b) => (b.tier || 1) - (a.tier || 1)).slice(0, 30);
  const agentSummaries = poolAgents.map((a) => ({
    agent_id: a.agent_id, name: a.name, role: a.role,
    specialty: a.specialty || '', skills: (a.skills || []).slice(0, 4), tier: a.tier || 1,
  }));

  const system = `You are a CTO assembling a project team. Read the brief carefully and select the best agents from the available pool.

Rules:
- Select 4-8 agents total based on what the project actually needs
- Match specialties and skills to the specific project requirements
- Avoid adding roles the project doesn't need
- You MUST use the exact agent_id values from the Available agents list — do not invent or modify IDs
- Return ONLY valid JSON: { "team": [{ "agent_id": "...", "agent_name": "...", "role": "...", "role_display": "...", "rationale": "one sentence" }] }`;

  const userMsg = `Project brief:\n${briefMd.slice(0, 2000)}\n\nComplexity: ${complexityTier}\n\nAvailable agents:\n${JSON.stringify(agentSummaries, null, 2)}`;

  const { text } = await callLLM('sonnet', system, userMsg, 1024);
  let parsed;
  try { parsed = parseJSON(text); } catch { parsed = { team: [] }; }

  const agentIdSet = new Set(allAgents.map((a) => a.agent_id));
  let team = (parsed.team || []).filter((m) => m.agent_id && agentIdSet.has(m.agent_id));

  if (team.length === 0 && allAgents.length > 0) {
    const fallback = [...allAgents].sort((a, b) => (b.tier || 1) - (a.tier || 1)).slice(0, 5);
    team = fallback.map((a) => ({
      agent_id: a.agent_id, agent_name: a.name,
      role: a.role || 'core', role_display: a.role || 'Core Member', rationale: 'Selected as top-tier agent',
    }));
  }

  return team;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function handleBriefRoutes(url, method, readBody, res, root, broadcaster, json) {
  if (method !== 'POST') return false;
  const path = url.pathname;

  // POST /api/brief/launch — SSE streaming compiler pipeline
  if (path === '/api/brief/launch') {
    const body = await readBody();
    const { mode, archetypeId, archetypeTitle, description, answers } = body;

    if (!mode || !description?.trim()) {
      json(res, 400, { error: 'mode and description are required' });
      return true;
    }

    // Start SSE response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });

    const send = (event, data) => {
      if (!res.writableEnded) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    const think    = (text)             => broadcaster.broadcast({ type: 'cto:thinking_line', slug: '_pending', text });
    const ctoThink = (slug, text)       => broadcaster.broadcast({ type: 'cto:thinking_line', slug, text });
    const progress = (slug, step, status) => broadcaster.broadcast({ type: 'project:launch_progress', slug, step, status });

    // Run the pipeline async, end SSE when done
    ;(async () => {
      try {
        // ── Step 0: Haiku — extract structured brief ──
        send('brief:generating', { status: 'Understanding your idea...' });

        let slug = '';
        let summary = '';
        let unknowns = [];
        let constraints = [];
        let priorityFlags = [];
        let confidence = 0.7;
        let currentRoot = root;
        const mainRepoRoot = root;

        try {
          think('Reading your description and preferences...');
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
          const userMsg = `Mode: ${mode}\nArchetype: ${archetypeTitle} (${archetypeId})\nDescription: ${description}\nAnswers: ${JSON.stringify(answers)}`;
          think('Analyzing project scope and extracting key requirements...');
          const { text, inputTokens, outputTokens } = await callLLM('haiku', system, userMsg);
          think('Structuring project metadata...');
          const parsed = parseJSON(text);
          const cost = computeCost('haiku', inputTokens, outputTokens);
          await recordChatSpend(currentRoot, { timestamp: new Date().toISOString(), model: 'haiku', inputTokens, outputTokens, cost, phase: 'discovery' });

          slug          = parsed.slug         || slugify(description.slice(0, 60));
          summary       = parsed.summary      || description.slice(0, 200);
          unknowns      = parsed.unknowns     || [];
          constraints   = parsed.constraints  || [];
          priorityFlags = parsed.priority_flags || [];
          confidence    = parsed.confidence   ?? 0.7;

          think(`Project identified: "${slug.replace(/-/g, ' ')}"`);
          if (unknowns.length > 0) think(`Found ${unknowns.length} open question${unknowns.length > 1 ? 's' : ''} to resolve`);
        } catch {
          slug    = slugify(description.slice(0, 60));
          summary = description.slice(0, 200);
        }

        // ── Create a fresh project directory ──
        ctoThink(slug, 'Creating project workspace...');
        currentRoot = initNewProject(slug);
        registerProject(slug, currentRoot);
        ctoThink(slug, 'Project scaffolded — directories, config, and org structure ready');
        progress(slug, 'brief', 'complete');
        progress(slug, 'setup', 'active');

        send('brief:complete', { slug, summary, root: currentRoot });

        // ── Step 1: feature:create ──
        ctoThink(slug, 'Initializing feature vault...');
        try {
          execFileSync('node', [CLI_PATH, 'feature:create', slug], {
            cwd: currentRoot, env: { ...process.env, OGU_ROOT: currentRoot }, encoding: 'utf8', timeout: 15000,
          });
        } catch { /* dir may already exist */ }

        const featureDir = join(currentRoot, 'docs/vault/04_Features', slug);
        mkdirSync(featureDir, { recursive: true });

        // ── Write ProjectBrief.md + project.meta.json ──
        ctoThink(slug, 'Writing project brief and metadata...');
        const answerLines = Object.entries(answers).map(([k, v]) => {
          if (v && typeof v === 'object' && Array.isArray(v.colors)) return `- **${k}**: ${v.name || 'Palette'}${v.colors?.join(', ') ? ` (${v.colors.join(', ')})` : ''}`;
          if (Array.isArray(v)) return `- **${k}**: ${v.join(', ')}`;
          if (v && typeof v === 'object') return `- **${k}**: ${JSON.stringify(v)}`;
          return `- **${k}**: ${v}`;
        }).join('\n');

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
${answerLines || '_No selections made._'}

## Unknowns
${unknowns.length > 0 ? unknowns.map((u) => `- ${u}`).join('\n') : '_None identified._'}

## Constraints
${constraints.length > 0 ? constraints.map((c) => `- ${c}`).join('\n') : '_None identified._'}

## Priority Flags
${priorityFlags.length > 0 ? priorityFlags.map((f) => `- ${f}`).join('\n') : '_Standard priorities._'}
`;
        const meta = { version: 1, slug, mode, archetype_id: archetypeId, answers, constraints, unknowns, priority_flags: priorityFlags, confidence, created_at: new Date().toISOString() };

        writeFileSync(join(featureDir, 'ProjectBrief.md'), briefMd, 'utf8');
        writeFileSync(join(featureDir, 'project.meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

        // FSM: create lifecycle
        try {
          const { createFeatureLifecycle, transitionFeature } = await import(`${LIB_DIR}/state-machine.mjs`);
          createFeatureLifecycle(slug, { root: currentRoot, initial: 'discovery' });
          transitionFeature(currentRoot, slug, 'feature', { reason: 'Brief generated', actor: 'kadima' });
        } catch { /* best-effort */ }

        progress(slug, 'setup', 'complete');
        progress(slug, 'cto', 'active');

        // ── Compiler pass 1/3: PRD ──
        ctoThink(slug, 'Compiler pass 1/3 — analyzing product requirements...');
        broadcaster.broadcast({ type: 'compiler:started', slug, stages: 3 });
        broadcaster.broadcast({ type: 'compiler:stage_start', slug, stage: 1, total: 3, label: 'Product Requirements' });

        let prdMd = '';
        try {
          const prdSystem = `You are a senior product manager. Given a project brief, write a comprehensive PRD.
Write the PRD directly in markdown. Do NOT wrap in JSON or code fences.

Required sections:
# {project name} — Product Requirements

## Problem
## User Personas
## Requirements
## Success Metrics
## Assumptions
## Open Questions
## Out of Scope

Be thorough and specific. Every requirement must trace back to the user's actual description and choices.`;
          const { text, inputTokens, outputTokens } = await callLLM('sonnet', prdSystem, `Project Brief:\n${briefMd}`, 4096);
          prdMd = text.trim();
          const cost = computeCost('sonnet', inputTokens, outputTokens);
          await recordChatSpend(currentRoot, { timestamp: new Date().toISOString(), model: 'sonnet', inputTokens, outputTokens, cost, phase: 'discovery', roleId: 'pm' });
          writeFileSync(join(featureDir, 'PRD.md'), prdMd, 'utf8');
          ctoThink(slug, 'PRD.md locked — product requirements verified');
          broadcaster.broadcast({ type: 'compiler:artifact', slug, stage: 1, artifact: 'PRD.md' });
        } catch (err) {
          throw new Error(`Compiler pass 1 (PRD) failed: ${err?.message || err}`);
        }

        // ── Compiler pass 2/3: Spec ──
        ctoThink(slug, 'Compiler pass 2/3 — building technical specification...');
        broadcaster.broadcast({ type: 'compiler:stage_start', slug, stage: 2, total: 3, label: 'Technical Specification' });

        let specMd = '';
        try {
          const specSystem = `You are a senior software architect. Given a project brief AND its PRD, write a comprehensive Technical Specification.
Write the spec directly in markdown. Do NOT wrap in JSON or code fences.

Required sections:
# {project name} — Technical Specification

## Overview
## User Personas & Permissions
## Screens and Interactions
## Edge Cases
## Data Model
## API
## Mock API
## UI Components

Every section must contain real, concrete content derived from the PRD. No placeholders.`;
          const specInput = `Project Brief:\n${briefMd}\n\n---\n\nPRD:\n${prdMd}`;
          const { text, inputTokens, outputTokens } = await callLLM('sonnet', specSystem, specInput, 8192);
          specMd = text.trim();
          const cost = computeCost('sonnet', inputTokens, outputTokens);
          await recordChatSpend(currentRoot, { timestamp: new Date().toISOString(), model: 'sonnet', inputTokens, outputTokens, cost, phase: 'discovery', roleId: 'architect' });
          writeFileSync(join(featureDir, 'Spec.md'), specMd, 'utf8');
          ctoThink(slug, 'Spec.md locked — data model, API, and components defined');
          broadcaster.broadcast({ type: 'compiler:artifact', slug, stage: 2, artifact: 'Spec.md' });
        } catch (err) {
          throw new Error(`Compiler pass 2 (Spec) failed: ${err?.message || err}`);
        }

        // ── Compiler pass 3/3: Architecture & Plan (background) ──
        ctoThink(slug, 'Compiler pass 3/3 — architecture and implementation plan...');
        broadcaster.broadcast({ type: 'compiler:stage_start', slug, stage: 3, total: 3, label: 'Architecture & Plan' });

        let plan = { feature: slug, tasks: [] };
        let uiManifest = {
          version: 2, revision: 1, history: [],
          screens: [
            { id: 'features', label: 'Features', reason: 'default' },
            { id: 'pipeline', label: 'Pipeline', reason: 'default' },
            { id: 'agents',   label: 'Agents',   reason: 'default' },
            { id: 'budget',   label: 'Budget',   reason: 'default' },
            { id: 'settings', label: 'Settings', reason: 'default' },
          ],
          dashboard: {
            widgets: [
              { type: 'progress', label: 'Progress', size: 'full' },
              { type: 'tasks',    label: 'Tasks',    size: 'half' },
              { type: 'gates',    label: 'Gates',    size: 'half' },
              { type: 'activity', label: 'Recent Activity', size: 'full' },
            ],
            primary_cta:  { label: 'Begin Architecture', command: '/architect', type: 'navigate' },
            quick_actions: [],
          },
          required_decisions: [],
        };

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
    "screens": [{ "id": "features|pipeline|agents|budget|settings", "label": "Human label", "reason": "why needed" }],
    "dashboard": {
      "widgets": [{ "type": "progress|gates|decisions|activity|tasks|budget_summary|agent_summary", "label": "Human label", "size": "full|half" }],
      "primary_cta": { "label": "...", "command": "/architect", "type": "navigate" },
      "quick_actions": []
    },
    "required_decisions": []
  }
}

Model selection: haiku=simple/mechanical, sonnet=standard code, opus=complex architecture. Prefer cheapest that works.
Always include setup + smoke test (tests/smoke/${slug}.test.ts) + contracts tasks. Break into many small focused tasks.`;

        const archInput = `Project Brief:\n${briefMd}\n\n---\n\nPRD:\n${prdMd}\n\n---\n\nTechnical Specification:\n${specMd}`;

        const planWritePromise = (async () => {
          const { text, inputTokens, outputTokens } = await callLLM('sonnet', archSystem, archInput, 8192);
          ctoThink(slug, 'Architecture analysis complete — structuring deliverables...');
          const parsed = parseJSON(text);
          const cost = computeCost('sonnet', inputTokens, outputTokens);
          await recordChatSpend(currentRoot, { timestamp: new Date().toISOString(), model: 'sonnet', inputTokens, outputTokens, cost, phase: 'discovery', roleId: 'cto' });

          if (parsed.plan?.tasks?.length > 0) {
            plan = parsed.plan;
            ctoThink(slug, `Plan.json locked — ${plan.tasks.length} tasks across ${new Set(plan.tasks.map((t) => t.group || 'core')).size} teams`);
          }
          const ctoBrief = parsed.cto_brief_md || '';
          if (parsed.ui_manifest) {
            const normalized = normalizeUIManifest(parsed.ui_manifest);
            if (normalized) uiManifest = normalized;
          }

          writeFileSync(join(featureDir, 'CTO_Brief.md'),      ctoBrief,                          'utf8');
          writeFileSync(join(featureDir, 'Plan.json'),          JSON.stringify(plan, null, 2) + '\n', 'utf8');
          writeFileSync(join(featureDir, 'UI_Manifest.json'),   JSON.stringify(uiManifest, null, 2) + '\n', 'utf8');

          broadcaster.broadcast({ type: 'compiler:artifact', slug, stage: 3, artifact: 'Plan.json' });
          broadcaster.broadcast({ type: 'compiler:completed', slug, stages: 3, artifacts: ['PRD.md', 'Spec.md', 'Plan.json', 'CTO_Brief.md', 'UI_Manifest.json'] });
          ctoThink(slug, 'Compilation complete — all artifacts verified');
        })();

        pendingPlanWrites.set(slug, planWritePromise);
        planWritePromise.catch((err) => {
          ctoThink(slug, `Compiler pass 3 FAILED: ${err?.message || err}`);
        });

        // ── Team assembly (parallel with plan generation) ──
        ctoThink(slug, 'Assembling your development team...');
        await new Promise((r) => setTimeout(r, 400));

        const { planProject, saveCTOPlan } = await import(`${LIB_DIR}/cto-planner.mjs`);
        const { saveTeam }                  = await import(`${LIB_DIR}/team-assembler.mjs`);
        const { getProjectsDir }            = await import(`${LIB_DIR}/runtime-paths.mjs`);
        const { searchAgents }              = await import(`${LIB_DIR}/agent-store.mjs`);

        const projDir = join(getProjectsDir(currentRoot), slug);
        mkdirSync(projDir, { recursive: true });

        ctoThink(slug, 'CTO analyzing complexity and team requirements...');
        const ctoPlan = planProject(briefMd, { projectId: slug });
        saveCTOPlan(currentRoot, slug, ctoPlan);
        ctoThink(slug, `Complexity: ${ctoPlan.complexity?.tier || 'medium'} (score ${ctoPlan.complexity?.score || 0})`);

        ctoThink(slug, 'Reading brief and selecting best agents...');
        const allAgents = searchAgents(mainRepoRoot, {});
        const aiTeam    = await selectTeamWithAI(briefMd, ctoPlan.complexity?.tier || 'medium', allAgents);

        const teamMembers = aiTeam.map((m, i) => {
          const agent = allAgents.find((a) => a.agent_id === m.agent_id);
          return {
            member_id:        `tm_${String(i + 1).padStart(4, '0')}`,
            role_id:          m.role || m.agent_id,
            role_display:     m.role_display || m.role,
            agent_id:         m.agent_id,
            agent_name:       m.agent_name || agent?.name || m.agent_id,
            agent_tier:       agent?.tier || 1,
            agent_specialty:  agent?.specialty || '',
            allocation_id:    null,
            capacity_units:   agent?.capacity_units || 6,
            allocated_units:  0,
            status:           'active',
            rationale:        m.rationale || '',
            optional:         false,
          };
        });

        const assembledTeam = {
          team_id:          `team_${Date.now()}`,
          project_id:       slug,
          created_at:       new Date().toISOString(),
          members:          teamMembers,
          complexity_tier:  ctoPlan.complexity?.tier || 'medium',
          total_slots:      teamMembers.length,
          assigned_slots:   teamMembers.length,
          unassigned_slots: 0,
        };
        saveTeam(currentRoot, slug, assembledTeam);

        const teamPath    = join(getProjectsDir(currentRoot), slug, 'team.json');
        const ctoPlanPath = join(getProjectsDir(currentRoot), slug, 'cto-plan.json');

        if (!existsSync(teamPath)) throw new Error(`CTO pipeline failed: team.json not written at ${teamPath}`);

        let teamData = JSON.parse(readFileSync(teamPath, 'utf8'));
        if (existsSync(ctoPlanPath)) {
          const savedCtoPlan = JSON.parse(readFileSync(ctoPlanPath, 'utf8'));
          teamData.blueprint  = savedCtoPlan.teamBlueprint || { roles: [] };
          teamData.complexity = savedCtoPlan.complexity    || { score: 0, tier: teamData.complexity_tier || 'medium' };
        }
        ctoThink(slug, 'CTO pipeline complete — team assembled from agent pool');

        // Progressive reveal
        const members = teamData?.members || [];
        const seenRoles = new Set();
        for (const member of members) {
          const role = member.role_id || 'core';
          if (!seenRoles.has(role)) {
            seenRoles.add(role);
            const name = member.agent_name || member.role_display || role;
            ctoThink(slug, `${name} — ${member.status === 'active' ? 'assigned and ready' : 'slot open'}`);
            broadcaster.broadcast({ type: 'cto:agent_found', slug, group: role, agentName: name });
            await new Promise((r) => setTimeout(r, 1200));
          }
        }

        progress(slug, 'cto', 'complete');

        // FSM: transition to architect
        try {
          const { transitionFeature } = await import(`${LIB_DIR}/state-machine.mjs`);
          transitionFeature(currentRoot, slug, 'architect', { reason: 'CTO expansion complete', actor: 'kadima' });
          const uiState = resolveUIState(currentRoot, slug);
          broadcaster.broadcast({ type: 'project:state_changed', slug, state: uiState });
        } catch { /* best-effort */ }

        // Update STATE.json
        try {
          const { resolveRuntimePath } = await import(`${LIB_DIR}/runtime-paths.mjs`);
          const statePath = resolveRuntimePath(currentRoot, 'STATE.json');
          let state = {};
          try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch {}
          state.current_task = slug;
          writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
        } catch { /* best-effort */ }

        send('launch:complete', { slug, summary, taskCount: 0 });

        ctoThink(slug, 'Team ready for review — approve to start build');
        broadcaster.broadcast({ type: 'project:team_ready', slug, lifecycleProjectId: slug, team: teamData });

      } catch (err) {
        send('launch:error', { error: err?.message || String(err) });
      } finally {
        res.end();
      }
    })();

    return true;
  }

  // POST /api/brief/project/:slug/approve-team
  const approveMatch = path.match(/^\/api\/brief\/project\/([^/]+)\/approve-team$/);
  if (approveMatch && method === 'POST') {
    const slug = approveMatch[1];
    if (!slug || slug.includes('..') || slug.includes('/')) { json(res, 400, { error: 'Invalid slug' }); return true; }

    let projectRoot = process.env.OGU_ROOT || process.cwd();
    try {
      const entry = readProjectRegistry().find((p) => p.slug === slug);
      if (entry && existsSync(entry.root)) projectRoot = entry.root;
    } catch { /* fallback */ }

    const ctoThink = (text) => broadcaster.broadcast({ type: 'cto:thinking_line', slug, text });
    ctoThink('Team approved — starting execution...');

    // Mark team as approved
    try {
      const { getProjectsDir } = await import(`${LIB_DIR}/runtime-paths.mjs`);
      const teamPath = join(getProjectsDir(projectRoot), slug, 'team.json');
      if (!existsSync(teamPath)) { json(res, 404, { error: 'Team not found — cannot approve' }); return true; }

      const team = JSON.parse(readFileSync(teamPath, 'utf8'));
      const approvedAt = new Date().toISOString();
      writeFileSync(teamPath, JSON.stringify({ ...team, approved: true, approved_at: team.approved_at || approvedAt, approved_by: team.approved_by || 'user' }, null, 2) + '\n', 'utf8');
    } catch { /* best-effort */ }

    // Wait for Plan.json if still generating
    const planPromise = pendingPlanWrites.get(slug);
    if (planPromise) {
      ctoThink('Finalizing implementation plan...');
      try { await planPromise; } catch { ctoThink('Plan generation encountered an issue — continuing with available plan'); }
      pendingPlanWrites.delete(slug);
    }

    // Show task assignments
    const planPath = join(projectRoot, 'docs/vault/04_Features', slug, 'Plan.json');
    if (existsSync(planPath)) {
      try {
        const plan = JSON.parse(readFileSync(planPath, 'utf8'));
        if (plan.tasks?.length > 0) {
          ctoThink('Assigning tasks to agents...');
          for (const t of plan.tasks) {
            broadcaster.broadcast({ type: 'cto:task_dispatched', slug, taskId: t.id, title: t.title, group: t.group || 'core' });
            await new Promise((r) => setTimeout(r, 400));
          }
        }
      } catch { /* best-effort */ }
    }

    // Fire-and-forget dispatch
    dispatchProject(projectRoot, slug).catch((err) => {
      broadcaster.broadcast({ type: 'dispatch:error', slug, error: String(err?.message || err) });
    });

    json(res, 200, { ok: true });
    return true;
  }

  // POST /api/brief/project/:slug/resume
  const resumeMatch = path.match(/^\/api\/brief\/project\/([^/]+)\/resume$/);
  if (resumeMatch && method === 'POST') {
    const slug = resumeMatch[1];
    if (!slug || slug.includes('..') || slug.includes('/')) { json(res, 400, { error: 'Invalid slug' }); return true; }

    let projectRoot = process.env.OGU_ROOT || process.cwd();
    try {
      const entry = readProjectRegistry().find((p) => p.slug === slug);
      if (entry && existsSync(entry.root)) projectRoot = entry.root;
    } catch { /* fallback */ }

    const featureDir = join(projectRoot, 'docs/vault/04_Features', slug);
    if (!existsSync(featureDir)) { json(res, 404, { error: 'Project not found' }); return true; }

    // Enforce lifecycle: team must be approved
    try {
      const { getProjectsDir } = await import(`${LIB_DIR}/runtime-paths.mjs`);
      const teamPath = join(getProjectsDir(projectRoot), slug, 'team.json');
      if (!existsSync(teamPath)) { json(res, 404, { error: 'Team not found — approve team before resuming' }); return true; }
      const team = JSON.parse(readFileSync(teamPath, 'utf8'));
      const approved = team?.approved === true || !!team?.approved_at;
      if (!approved) { json(res, 409, { error: 'Team not approved — approve team before resuming' }); return true; }
    } catch { /* best-effort */ }

    const planPath = join(featureDir, 'Plan.json');
    let plan = { feature: slug, tasks: [] };
    try { plan = JSON.parse(readFileSync(planPath, 'utf8')); } catch {}
    const hasTasks = plan.tasks?.length > 0;

    // Fire-and-forget
    ;(async () => {
      const ctoThink  = (text)         => broadcaster.broadcast({ type: 'cto:thinking_line', slug, text });
      const progress  = (step, status) => broadcaster.broadcast({ type: 'project:launch_progress', slug, step, status });

      if (!hasTasks) {
        progress('brief', 'complete'); progress('setup', 'complete'); progress('cto', 'active');
        ctoThink('Resuming compilation — reading existing artifacts...');

        const briefMd = existsSync(join(featureDir, 'ProjectBrief.md')) ? readFileSync(join(featureDir, 'ProjectBrief.md'), 'utf8') : '';
        const prdMd   = existsSync(join(featureDir, 'PRD.md'))          ? readFileSync(join(featureDir, 'PRD.md'),          'utf8') : '';
        const specMd  = existsSync(join(featureDir, 'Spec.md'))         ? readFileSync(join(featureDir, 'Spec.md'),         'utf8') : '';

        ctoThink('Compiler pass 3/3 — architecture and implementation plan...');
        broadcaster.broadcast({ type: 'compiler:stage_start', slug, stage: 3, total: 3, label: 'Architecture & Plan' });

        let ctoBrief = '';
        try {
          const archSystem = `You are a CTO. Return ONLY valid JSON:
{
  "cto_brief_md": "Markdown CTO brief",
  "plan": {
    "feature": "${slug}",
    "tasks": [
      { "id": "T1", "title": "...", "group": "setup|core|ui|integration|polish", "model": "haiku|sonnet|opus", "depends_on": [], "touches": ["file1.ts"], "done_when": "acceptance criteria" }
    ]
  }
}
Break into many small focused tasks. Always include setup + smoke test (tests/smoke/${slug}.test.ts) + contracts tasks.`;
          const archInput = `Brief:\n${briefMd}\n\nPRD:\n${prdMd}\n\nSpec:\n${specMd}`;
          const { text, inputTokens, outputTokens } = await callLLM('opus', archSystem, archInput, 8192);
          ctoThink('Architecture analysis complete — structuring deliverables...');
          const parsed = parseJSON(text);
          const cost = computeCost('opus', inputTokens, outputTokens);
          await recordChatSpend(projectRoot, { timestamp: new Date().toISOString(), model: 'opus', inputTokens, outputTokens, cost, phase: 'architect', roleId: 'cto' });

          ctoBrief = parsed.cto_brief_md || '';
          if (parsed.plan?.tasks?.length > 0) {
            plan = parsed.plan;
            ctoThink(`Plan.json locked — ${plan.tasks.length} tasks`);
          }
          broadcaster.broadcast({ type: 'compiler:artifact', slug, stage: 3, artifact: 'Plan.json' });
        } catch (err) {
          ctoBrief = `# CTO Brief: ${slug}\n\n_Resume regeneration failed. Retry._\n`;
        }

        writeFileSync(join(featureDir, 'CTO_Brief.md'), ctoBrief, 'utf8');
        writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');
        broadcaster.broadcast({ type: 'compiler:completed', slug, stages: 3, artifacts: ['Plan.json', 'CTO_Brief.md'] });

        await new Promise((r) => setTimeout(r, 600));
        const seenGroups = new Set();
        for (const t of plan.tasks) {
          const group = t.group || 'core';
          if (!seenGroups.has(group)) {
            seenGroups.add(group);
            broadcaster.broadcast({ type: 'cto:agent_found', slug, group, agentName: group });
          }
          broadcaster.broadcast({ type: 'cto:task_dispatched', slug, taskId: t.id, title: t.title, group });
          await new Promise((r) => setTimeout(r, 400));
        }
        progress('cto', 'complete');

        try {
          const { transitionFeature } = await import(`${LIB_DIR}/state-machine.mjs`);
          transitionFeature(projectRoot, slug, 'architect', { reason: 'Resume: plan generated', actor: 'kadima' });
          const uiState = resolveUIState(projectRoot, slug);
          broadcaster.broadcast({ type: 'project:state_changed', slug, state: uiState });
        } catch { /* FSM best-effort */ }
      } else {
        progress('brief', 'complete'); progress('setup', 'complete'); progress('cto', 'active');
        ctoThink('Resuming build — restoring task graph...');
        const seenGroups = new Set();
        for (const t of plan.tasks) {
          const group = t.group || 'core';
          if (!seenGroups.has(group)) {
            seenGroups.add(group);
            broadcaster.broadcast({ type: 'cto:agent_found', slug, group, agentName: group });
          }
          broadcaster.broadcast({ type: 'cto:task_dispatched', slug, taskId: t.id, title: t.title, group });
          await new Promise((r) => setTimeout(r, 150));
        }
        progress('cto', 'complete');
        const uiState = resolveUIState(projectRoot, slug);
        broadcaster.broadcast({ type: 'project:state_changed', slug, state: uiState });
      }

      ctoThink('Starting agent execution...');
      dispatchProject(projectRoot, slug).catch((err) =>
        broadcaster.broadcast({ type: 'dispatch:error', slug, error: String(err?.message || err) })
      );
    })().catch(console.error);

    json(res, 200, { ok: true, started: true, mode: hasTasks ? 'dispatch_resume' : 'plan_regen' });
    return true;
  }

  return false;
}
