/**
 * project-lifecycle.ts — Slice 421
 * Studio API for marketplace project lifecycle.
 *
 * Routes:
 *   POST /project-lifecycle/launch     — wizard → CTO → Team → PRD → Enrich
 *   GET  /project-lifecycle/:id        — full project state from .ogu/projects/{id}/
 *   GET  /project-lifecycle/:id/status — execution state only
 *   POST /project-lifecycle/:id/run    — execute enriched plan (async, simulate flag)
 *
 * Mounts at /api (called from index.ts):
 *   app.route("/api", createProjectLifecycleRouter());
 */

import { Hono } from "hono";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

function getRoot(): string {
  return process.env.OGU_ROOT || process.cwd();
}

// Import core logic from project-executor (pure .mjs — fully testable)
async function getExecutor() {
  return await import(
    /* @vite-ignore */ "../../../../tools/ogu/commands/lib/project-executor.mjs"
  );
}

export function createProjectLifecycleRouter() {
  const router = new Hono();

  // Enforce single lifecycle — disable legacy project-lifecycle unless explicitly enabled
  if (process.env.OGU_LIFECYCLE_MODE !== "project-lifecycle") {
    router.all("/*", (c) => c.json({
      error: "project-lifecycle is disabled. Use /brief/launch + /brief/project/:slug/approve-team for the unified lifecycle.",
    }, 410));
    return router;
  }

  // ── POST /project-lifecycle/launch ────────────────────────────────────────
  // Wizard → CTO planner → Team assembler → PRD → Task enrichment
  // Body: { projectId: string, brief: string, simulate?: boolean }
  router.post("/project-lifecycle/launch", async (c) => {
    const root = getRoot();
    const body = await c.req.json<{ projectId?: string; brief?: string; simulate?: boolean }>();

    const { projectId, brief } = body;
    const simulateRequested = body.simulate ?? false;
    const simulate = false;
    if (simulateRequested) {
      console.warn("[project-lifecycle] simulate requested but disabled — forcing real API calls");
    }
    if (!projectId || !brief) {
      return c.json({ error: "projectId and brief are required" }, 400);
    }
    if (projectId.includes("..") || projectId.includes("/")) {
      return c.json({ error: "Invalid projectId" }, 400);
    }

    try {
      const { launchProjectPipeline } = await getExecutor();
      const result = await launchProjectPipeline(root, projectId, brief, { simulate });
      return c.json({ ok: true, ...result });
    } catch (err: any) {
      return c.json({ error: err.message || "Launch failed" }, 500);
    }
  });

  // ── GET /project-lifecycle/:id ────────────────────────────────────────────
  // Full project state: ctoPlan + team + prd + enrichedPlan + executionState
  router.get("/project-lifecycle/:id", async (c) => {
    const root = getRoot();
    const id = c.req.param("id");

    try {
      const { readProjectData } = await getExecutor();
      const data = readProjectData(root, id);
      if (!data) return c.json({ error: "Project not found" }, 404);
      return c.json(data);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // ── GET /project-lifecycle/:id/status ─────────────────────────────────────
  // Execution state only (for polling)
  router.get("/project-lifecycle/:id/status", async (c) => {
    const root = getRoot();
    const id = c.req.param("id");

    try {
      const { getExecutionState } = await getExecutor();
      const state = getExecutionState(root, id);
      if (!state) return c.json({ status: "not_started", projectId: id });
      return c.json(state);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // ── GET /project-lifecycle/:id/metrics ───────────────────────────────────
  // Aggregated execution metrics
  router.get("/project-lifecycle/:id/metrics", async (c) => {
    const root = getRoot();
    const id = c.req.param("id");

    try {
      const { aggregateMetrics, loadMetrics } = await import(
        /* @vite-ignore */ "../../../../tools/ogu/commands/lib/execution-metrics.mjs"
      ) as any;
      const metrics = aggregateMetrics(root, id) || loadMetrics(root, id)?.aggregates || null;
      if (!metrics) return c.json({ projectId: id, metrics: null, message: "No metrics yet" });
      return c.json({ projectId: id, metrics });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // ── POST /project-lifecycle/:id/resume ───────────────────────────────────
  // Resume a partial/failed project, skipping already-completed tasks.
  // Body: { simulate?: boolean }
  router.post("/project-lifecycle/:id/resume", async (c) => {
    const root = getRoot();
    const id = c.req.param("id");
    const body = await c.req.json<{ simulate?: boolean }>().catch(() => ({}));
    const simulateRequested = body.simulate ?? false;
    const simulate = false;
    if (simulateRequested) {
      console.warn("[project-lifecycle] simulate requested but disabled — forcing real API calls");
    }

    try {
      const { canResume, resumeProject } = await import(
        /* @vite-ignore */ "../../../../tools/ogu/commands/lib/project-resume.mjs"
      ) as any;

      if (!canResume(root, id)) {
        return c.json({ error: "Project cannot be resumed (not found or already completed)" }, 400);
      }

      // Run async — respond immediately so client can poll /status
      resumeProject(root, id, { simulate }).catch(() => { /* state saved to disk */ });

      return c.json({ ok: true, projectId: id, simulate, message: "Resume started — poll /status for progress" });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // ── GET /project-lifecycle/:id/resume-point ───────────────────────────────
  // Check if a project can be resumed and get resume metadata.
  router.get("/project-lifecycle/:id/resume-point", async (c) => {
    const root = getRoot();
    const id = c.req.param("id");

    try {
      const { canResume, getResumePoint } = await import(
        /* @vite-ignore */ "../../../../tools/ogu/commands/lib/project-resume.mjs"
      ) as any;

      const resumable = canResume(root, id);
      if (!resumable) {
        return c.json({ resumable: false, projectId: id });
      }

      const point = getResumePoint(root, id);
      return c.json({ resumable: true, ...point });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // ── POST /project-lifecycle/:id/run ──────────────────────────────────────
  // Execute the enriched plan (simulate-safe)
  // Body: { simulate?: boolean }
  router.post("/project-lifecycle/:id/run", async (c) => {
    const root = getRoot();
    const id = c.req.param("id");
    const body = await c.req.json<{ simulate?: boolean }>().catch(() => ({}));
    const simulateRequested = body.simulate ?? false;
    const simulate = false;
    if (simulateRequested) {
      console.warn("[project-lifecycle] simulate requested but disabled — forcing real API calls");
    }

    try {
      const { runProject, getExecutionState } = await getExecutor();

      // Reject if already running
      const current = getExecutionState(root, id);
      if (current?.status === "running") {
        return c.json({ error: "Project is already running" }, 409);
      }

      // Run async — respond immediately so client can poll status
      runProject(root, id, { simulate }).catch(() => { /* state saved to disk */ });

      return c.json({ ok: true, projectId: id, simulate, message: "Execution started — poll /status for progress" });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  return router;
}
