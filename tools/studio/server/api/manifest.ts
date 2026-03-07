/**
 * Living UI Manifest — Kadima-driven layout evolution.
 *
 * Deterministic rules (no LLM) generate proposals when meaningful thresholds
 * are crossed.  User approves/dismisses.  Manifest is versioned with full history.
 *
 * GET  /project/:slug/manifest/pending  → latest pending proposal or null
 * POST /project/:slug/manifest/apply    → apply proposal, bump revision, broadcast
 * POST /project/:slug/manifest/dismiss  → mark proposal dismissed
 */

import { Hono } from "hono";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { getStateDir } from "../../../ogu/commands/lib/runtime-paths.mjs";
import { broadcast } from "../ws/server.js";

function getRoot(): string {
  return process.env.OGU_ROOT || process.cwd();
}

function readJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// ── Trigger types ──

export type TriggerKind =
  | "phase_transition"
  | "progress_milestone"
  | "budget_threshold"
  | "error_spike";

export interface ManifestOp {
  action: "add_screen" | "add_widget" | "set_cta";
  target: string; // screen id or widget type or cta label
  label: string;
  reason: string;
}

export interface ManifestProposal {
  id: string;
  slug: string;
  trigger: TriggerKind;
  detail: string;
  ops: ManifestOp[];
  summary: string;
  status: "pending" | "applied" | "dismissed";
  createdAt: string;
}

// ── Trigger rules (deterministic, no LLM) ──

interface Rule {
  trigger: TriggerKind;
  match: (detail: string) => boolean;
  ops: (manifest: any) => ManifestOp[];
}

function hasScreen(manifest: any, id: string): boolean {
  return Array.isArray(manifest?.screens) &&
    manifest.screens.some((s: any) => s.id === id);
}

function hasWidget(manifest: any, type: string): boolean {
  return Array.isArray(manifest?.dashboard?.widgets) &&
    manifest.dashboard.widgets.some((w: any) => w.type === type);
}

const RULES: Rule[] = [
  {
    trigger: "phase_transition",
    match: (d) => d === "building",
    ops: (m) => {
      const ops: ManifestOp[] = [];
      if (!hasScreen(m, "pipeline"))
        ops.push({ action: "add_screen", target: "pipeline", label: "Pipeline", reason: "Build phase started" });
      if (!hasScreen(m, "agents"))
        ops.push({ action: "add_screen", target: "agents", label: "Agents", reason: "Agents executing tasks" });
      return ops;
    },
  },
  {
    trigger: "phase_transition",
    match: (d) => d === "verifying",
    ops: (m) => {
      const ops: ManifestOp[] = [];
      if (!hasWidget(m, "gates"))
        ops.push({ action: "add_widget", target: "gates", label: "Gates", reason: "Verification phase — gates track progress" });
      return ops;
    },
  },
  {
    trigger: "phase_transition",
    match: (d) => d === "done",
    ops: () => [
      { action: "set_cta", target: "View Summary", label: "View Summary", reason: "Project complete" },
    ],
  },
  {
    trigger: "progress_milestone",
    match: (d) => d === "50",
    ops: (m) => {
      const ops: ManifestOp[] = [];
      if (!hasWidget(m, "gates"))
        ops.push({ action: "add_widget", target: "gates", label: "Gates", reason: "Halfway through — gates visibility helps" });
      return ops;
    },
  },
  {
    trigger: "progress_milestone",
    match: (d) => d === "100",
    ops: (m) => {
      const ops: ManifestOp[] = [];
      if (!hasWidget(m, "agent_summary"))
        ops.push({ action: "add_widget", target: "agent_summary", label: "Agent Summary", reason: "All tasks complete — review agent performance" });
      return ops;
    },
  },
  {
    trigger: "budget_threshold",
    match: (d) => d === "50",
    ops: (m) => {
      const ops: ManifestOp[] = [];
      if (!hasWidget(m, "budget_summary"))
        ops.push({ action: "add_widget", target: "budget_summary", label: "Budget Summary", reason: "Over 50% budget consumed" });
      return ops;
    },
  },
  {
    trigger: "error_spike",
    match: () => true,
    ops: (m) => {
      const ops: ManifestOp[] = [];
      if (!hasWidget(m, "agent_summary"))
        ops.push({ action: "add_widget", target: "agent_summary", label: "Agent Summary", reason: "Error spike detected — review agents" });
      return ops;
    },
  },
];

// ── Core functions ──

function proposalsDir(root: string, slug: string): string {
  const dir = join(getStateDir(root), "manifest-proposals");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function generateProposal(
  root: string,
  slug: string,
  trigger: TriggerKind,
  detail: string,
): ManifestProposal | null {
  const featureDir = join(root, "docs/vault/04_Features", slug);
  const manifestPath = join(featureDir, "UI_Manifest.json");
  const manifest = readJson(manifestPath);
  if (!manifest) return null;

  // Collect all matching ops
  const ops: ManifestOp[] = [];
  for (const rule of RULES) {
    if (rule.trigger === trigger && rule.match(detail)) {
      ops.push(...rule.ops(manifest));
    }
  }

  if (ops.length === 0) return null;

  const id = `${slug}-${Date.now()}`;
  const proposal: ManifestProposal = {
    id,
    slug,
    trigger,
    detail,
    ops,
    summary: ops.map((o) => `${o.action === "add_screen" ? "+ Screen" : o.action === "add_widget" ? "+ Widget" : "CTA"}: ${o.label}`).join(", "),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  // Write to disk
  const dir = proposalsDir(root, slug);
  writeFileSync(join(dir, `${id}.json`), JSON.stringify(proposal, null, 2) + "\n", "utf-8");

  return proposal;
}

export function applyProposal(root: string, slug: string, proposalId: string): boolean {
  const dir = proposalsDir(root, slug);
  const proposalPath = join(dir, `${proposalId}.json`);
  const proposal: ManifestProposal | null = readJson(proposalPath);
  if (!proposal || proposal.status !== "pending") return false;

  const featureDir = join(root, "docs/vault/04_Features", slug);
  const manifestPath = join(featureDir, "UI_Manifest.json");
  const manifest = readJson(manifestPath);
  if (!manifest) return false;

  // Apply operations
  for (const op of proposal.ops) {
    if (op.action === "add_screen") {
      if (!Array.isArray(manifest.screens)) manifest.screens = [];
      if (!manifest.screens.some((s: any) => s.id === op.target)) {
        manifest.screens.push({ id: op.target, label: op.label, reason: op.reason });
      }
    } else if (op.action === "add_widget") {
      if (!manifest.dashboard) manifest.dashboard = { widgets: [], primary_cta: {}, quick_actions: [] };
      if (!Array.isArray(manifest.dashboard.widgets)) manifest.dashboard.widgets = [];
      if (!manifest.dashboard.widgets.some((w: any) => w.type === op.target)) {
        manifest.dashboard.widgets.push({ type: op.target, label: op.label, size: "half" });
      }
    } else if (op.action === "set_cta") {
      if (!manifest.dashboard) manifest.dashboard = { widgets: [], primary_cta: {}, quick_actions: [] };
      manifest.dashboard.primary_cta = { label: op.target, command: "/done", type: "navigate" };
    }
  }

  // Bump revision + append history
  manifest.revision = (manifest.revision || 1) + 1;
  if (!Array.isArray(manifest.history)) manifest.history = [];
  manifest.history.push({
    revision: manifest.revision,
    trigger: proposal.trigger,
    detail: proposal.detail,
    ops: proposal.ops,
    appliedAt: new Date().toISOString(),
  });

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

  // Mark proposal applied
  proposal.status = "applied";
  writeFileSync(proposalPath, JSON.stringify(proposal, null, 2) + "\n", "utf-8");

  return true;
}

export function dismissProposal(root: string, slug: string, proposalId: string): boolean {
  const dir = proposalsDir(root, slug);
  const proposalPath = join(dir, `${proposalId}.json`);
  const proposal: ManifestProposal | null = readJson(proposalPath);
  if (!proposal || proposal.status !== "pending") return false;

  proposal.status = "dismissed";
  writeFileSync(proposalPath, JSON.stringify(proposal, null, 2) + "\n", "utf-8");
  return true;
}

export function getPendingProposal(root: string, slug: string): ManifestProposal | null {
  const dir = join(getStateDir(root), "manifest-proposals");
  if (!existsSync(dir)) return null;

  const files = readdirSync(dir)
    .filter((f) => f.startsWith(`${slug}-`) && f.endsWith(".json"))
    .sort()
    .reverse(); // newest first

  for (const f of files) {
    const p: ManifestProposal | null = readJson(join(dir, f));
    if (p && p.status === "pending") return p;
  }
  return null;
}

export function hasRecentProposal(root: string, slug: string, windowMs = 60_000): boolean {
  const dir = join(getStateDir(root), "manifest-proposals");
  if (!existsSync(dir)) return false;

  const files = readdirSync(dir)
    .filter((f) => f.startsWith(`${slug}-`) && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return false;

  const latest: ManifestProposal | null = readJson(join(dir, files[0]));
  if (!latest) return false;

  const age = Date.now() - new Date(latest.createdAt).getTime();
  return age < windowMs;
}

// ── Router ──

export function createManifestRouter() {
  const router = new Hono();

  router.get("/project/:slug/manifest/pending", (c) => {
    const slug = c.req.param("slug");
    const root = getRoot();
    const proposal = getPendingProposal(root, slug);
    return c.json(proposal || null);
  });

  router.post("/project/:slug/manifest/apply", async (c) => {
    const slug = c.req.param("slug");
    const { proposalId } = await c.req.json();
    console.log(`[manifest] Apply request: slug=${slug}, proposalId=${proposalId}`);
    if (!proposalId) return c.json({ error: "proposalId is required" }, 400);

    const root = getRoot();
    console.log(`[manifest] Root: ${root}`);
    const ok = applyProposal(root, slug, proposalId);
    if (!ok) {
      console.error(`[manifest] Apply failed — proposal not found or already resolved`);
      return c.json({ error: "Proposal not found or already resolved" }, 400);
    }

    // Read updated manifest for revision number
    const manifestPath = join(root, "docs/vault/04_Features", slug, "UI_Manifest.json");
    const manifest = readJson(manifestPath);
    const revision = manifest?.revision || 0;

    // Broadcast manifest applied
    broadcast({ type: "manifest:applied", slug, revision } as any);

    // Broadcast full state change so UI reconfigures
    try {
      const { resolveUIState } = await import("./project-state.js");
      const uiState = resolveUIState(root, slug);
      if (uiState) {
        broadcast({ type: "project:state_changed", slug, state: uiState } as any);
      }
    } catch { /* best effort */ }

    return c.json({ ok: true, revision });
  });

  router.post("/project/:slug/manifest/dismiss", async (c) => {
    const slug = c.req.param("slug");
    const { proposalId } = await c.req.json();
    console.log(`[manifest] Dismiss request: slug=${slug}, proposalId=${proposalId}`);
    if (!proposalId) return c.json({ error: "proposalId is required" }, 400);

    const root = getRoot();
    const ok = dismissProposal(root, slug, proposalId);
    if (!ok) {
      console.error(`[manifest] Dismiss failed — proposal not found or already resolved`);
      return c.json({ error: "Proposal not found or already resolved" }, 400);
    }

    broadcast({ type: "manifest:dismissed", slug, proposalId } as any);

    return c.json({ ok: true });
  });

  return router;
}
