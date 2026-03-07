import { readFileSync as readFileSync0, existsSync as existsSync0 } from "fs";
import { resolve as resolve0 } from "path";
// Load .env before anything else
const envPath = resolve0(import.meta.dirname || __dirname, "..", ".env");
if (existsSync0(envPath)) {
  for (const line of readFileSync0(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.OGU_EXEC_MODE) process.env.OGU_EXEC_MODE = "spawn";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApiRouter } from "./api/router.js";
import { createAuthRouter } from "./api/auth.js";
import { createBillingRouter } from "./api/billing.js";
import { createAdminRouter } from "./api/admin.js";
import { createOrgsRouter } from "./api/orgs.js";
import { createWebhooksRouter } from "./api/webhooks.js";
import { createExecRouter } from "./api/exec.js";
import { createChatRouter } from "./api/chat.js";
import { createBrandRouter } from "./api/brand.js";
import { createKadimaProxy } from "./api/kadima-proxy.js";
import { createOguApi } from "./api/ogu-api.js";
import { createWizardRouter } from "./api/wizard.js";
import { createBriefRouter } from "./api/brief.js";
import { createProjectStateRouter } from "./api/project-state.js";
import { createManifestRouter } from "./api/manifest.js";
import { createKadimaRouter } from "./api/kadima.js";
import { createMarketplaceApi } from "./api/marketplace.js";
import { createProjectLifecycleRouter } from "./api/project-lifecycle.js";
import { setupWebSocket } from "./ws/server.js";
import { resolve, join } from "path";
import { existsSync, readFileSync } from "fs";
import { optionalAuth, requireAuth } from "./middleware/auth.js";

// ── Phase 3A: Session management ──
import { createSessionManager } from "../../ogu/commands/lib/session-manager.mjs";
import { cleanupStaleSessions } from "../../ogu/commands/lib/session-cleanup.mjs";
// ── Phase 3B: Materialized View Engine ──
import { createMaterializedViewEngine } from "../../ogu/commands/lib/materialized-view-engine.mjs";
import { VIEW_DEFINITIONS } from "../../ogu/commands/lib/view-reducers.mjs";

// ── Phase 4F: Rate Limiter + Circuit Breaker ──
import { createRateLimiter, RATE_PRESETS } from "../../ogu/commands/lib/rate-limiter.mjs";
import { createCircuitBreaker } from "../../ogu/commands/lib/circuit-breaker.mjs";
import { getProjectsDir, getStateDir, resolveRuntimePath } from "../../ogu/commands/lib/runtime-paths.mjs";
import { hasTaskGateEvidence } from "../../ogu/commands/lib/task-gate-evidence.mjs";

const args = process.argv.slice(2);
const isDev = args.includes("--dev");
const portFlag = args.indexOf("--port");
const port = portFlag >= 0 ? parseInt(args[portFlag + 1], 10) : 4200;

const studioRoot = resolve(import.meta.dirname || __dirname, "..");
const projectRoot = process.env.OGU_ROOT || resolve(studioRoot, "../..");
process.env.OGU_ROOT = projectRoot;
// Marketplace is global — always lives in the main Ogu repo, never per-project
if (!process.env.OGU_MARKETPLACE_ROOT) process.env.OGU_MARKETPLACE_ROOT = projectRoot;

const app = new Hono();

// Attach optional auth parsing for all API requests (sets ctx.var.user/userId when valid)
app.use("/api/*", optionalAuth);

// ── Phase 4F: Rate Limiter middleware (API burst protection) ──
const apiRateLimiter = createRateLimiter(RATE_PRESETS.api);
app.use("/api/*", async (c, next) => {
  if (!apiRateLimiter.tryConsume(1)) {
    return c.json({ error: "Too many requests" }, 429 as any);
  }
  return next();
});

// ── Phase 4F: Circuit Breaker for external calls ──
const externalCircuitBreaker = createCircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30000 });
// Expose globally so API routes can protect external calls
(globalThis as any).__externalCircuitBreaker = externalCircuitBreaker;

// API routes — public (no auth required)
const apiPublic = new Hono();
apiPublic.route("/", createAuthRouter());
apiPublic.route("/", createWebhooksRouter());
app.route("/api", apiPublic);

// API routes — protected (auth required in AOAS mode)
const apiProtected = new Hono();
apiProtected.use("/*", requireAuth);
apiProtected.route("/", createApiRouter());
apiProtected.route("/", createExecRouter());
apiProtected.route("/", createChatRouter());
apiProtected.route("/", createBrandRouter());
apiProtected.route("/kadima", createKadimaProxy());
apiProtected.route("/ogu", createOguApi());
apiProtected.route("/", createWizardRouter());
apiProtected.route("/", createBriefRouter());
apiProtected.route("/", createProjectStateRouter());
apiProtected.route("/", createManifestRouter());
apiProtected.route("/", createKadimaRouter());
apiProtected.route("/marketplace", createMarketplaceApi());
apiProtected.route("/", createProjectLifecycleRouter());
apiProtected.route("/", createBillingRouter());
apiProtected.route("/", createOrgsRouter());
apiProtected.route("/", createAdminRouter());
app.route("/api", apiProtected);

if (isDev) {
  console.log(`  Ogu Studio API server on http://127.0.0.1:${port}`);
} else {
  const distDir = join(studioRoot, "dist");
  if (existsSync(distDir)) {
    app.use("/*", serveStatic({ root: distDir }));
    app.get("*", (c) => {
      const html = readFileSync(join(distDir, "index.html"), "utf-8");
      return c.html(html);
    });
  } else {
    app.get("/", (c) => c.text("Run `npm run build` first to serve the Studio UI."));
  }
}

const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
  console.log(`\n  ⚡ Ogu Studio running at http://127.0.0.1:${info.port}`);
  console.log(`  Project: ${projectRoot}`);
  console.log(`  WebSocket: ws://127.0.0.1:${info.port}/ws\n`);
});

// Attach WebSocket to the HTTP server
setupWebSocket(server as any);

// ── Phase 3A: Initialize session manager ──
const studioSessionManager = createSessionManager();
// Expose globally so API routes can touch sessions
(globalThis as any).__studioSessionManager = studioSessionManager;

// ── Phase 3A: Cleanup stale agent sessions on startup ──
try {
  const cleanupResult = cleanupStaleSessions({ root: projectRoot, maxAgeMs: 4 * 60 * 60 * 1000 }); // 4 hours
  if (cleanupResult.cleaned > 0) {
    console.log(`  [session-cleanup] Cleaned ${cleanupResult.cleaned} stale agent session(s)`);
  }
} catch { /* cleanup is best-effort */ }

// ── Phase 3B: Initialize materialized view engine ──
const viewEngine = createMaterializedViewEngine() as any;
for (const def of (VIEW_DEFINITIONS as any[])) {
  viewEngine.registerView(def.name, { initialState: def.initialState, reducer: def.reducer });
}
// Expose globally so WS server can process events through views
(globalThis as any).__viewEngine = viewEngine;

// ── Auto-recovery: resume stuck dispatches on startup ──
// Safety: only resume projects whose FSM state was updated within the last hour.
// This prevents old/stale projects from auto-dispatching and interfering with active work.
setTimeout(async () => {
  try {
    const { readProjectRegistry } = await import("./api/router.js");
    const { dispatchProject, isPipelineActive } = await import("./api/dispatch.js");
    const { existsSync: ex, readFileSync: rf, statSync: st } = await import("fs");
    const { join: j } = await import("path");

    const registry = readProjectRegistry();
    const ONE_HOUR = 60 * 60 * 1000;

    for (const entry of registry) {
      if (!ex(entry.root)) continue;

      const planPath = j(entry.root, "docs/vault/04_Features", entry.slug, "Plan.json");
      if (!ex(planPath)) continue;

      // Skip if team not approved (enforce lifecycle)
      try {
        const teamPath = j(getProjectsDir(entry.root), entry.slug, "team.json");
        if (!ex(teamPath)) continue;
        const team = JSON.parse(rf(teamPath, "utf-8"));
        const approved = team?.approved === true || !!team?.approved_at;
        if (!approved) continue;
      } catch { continue; }

      // Only resume recently active projects (FSM state updated within last hour)
      const fsmPath = j(getStateDir(entry.root), "features", `${entry.slug}.state.json`);
      if (ex(fsmPath)) {
        try {
          const fsmMtime = st(fsmPath).mtime.getTime();
          if (Date.now() - fsmMtime > ONE_HOUR) {
            continue; // Stale project — skip
          }
        } catch { continue; }
      }

      let plan: { tasks?: Array<{ id: string }> };
      try { plan = JSON.parse(rf(planPath, "utf-8")); } catch { continue; }
      if (!plan.tasks?.length) continue;

      const doneTasks = plan.tasks.filter((t) => hasTaskGateEvidence(entry.root, t.id)).length;

      // Skip if explicitly aborted by user
      const abortedMarker = j(getStateDir(entry.root), "features", `${entry.slug}.aborted`);
      if (ex(abortedMarker)) continue;

      // Skip if project is already in verifying/done phase — don't re-run build
      const fsmStatePath = j(getStateDir(entry.root), "features", `${entry.slug}.state.json`);
      if (ex(fsmStatePath)) {
        try {
          const fsmState = JSON.parse(rf(fsmStatePath, "utf-8"));
          const phase = fsmState?.currentPhase || fsmState?.phase || fsmState?.current;
          if (phase === "verifying" || phase === "done" || phase === "completed" || phase === "build") continue;
        } catch { /* best effort */ }
      }

      // Also skip if GATE_STATE.json exists — means verification has been run, build is complete
      if (ex(resolveRuntimePath(entry.root, "GATE_STATE.json"))) continue;

      // Stuck = has tasks, not all done, no active pipeline
      if (doneTasks < plan.tasks.length && !isPipelineActive(entry.slug, entry.root)) {
        console.log(`[auto-recovery] Resuming stuck dispatch: ${entry.slug} (${doneTasks}/${plan.tasks.length} done)`);
        dispatchProject(entry.root, entry.slug).catch((err: Error) =>
          console.warn(`[auto-recovery] Dispatch failed for ${entry.slug}:`, err.message)
        );
      }
    }
  } catch (err: any) {
    console.warn("[auto-recovery] Startup check failed:", err.message);
  }
}, 2000); // 2s delay — let WS and routes initialize first

process.on("SIGINT", () => { server.close(); process.exit(0); });
process.on("SIGTERM", () => { server.close(); process.exit(0); });
