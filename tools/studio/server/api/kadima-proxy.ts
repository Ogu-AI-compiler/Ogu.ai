/**
 * Kadima Proxy — forwards Studio API requests to the Kadima daemon.
 *
 * Kadima daemon runs on port 4210 (configurable via .ogu/kadima.config.json).
 * This module proxies /api/kadima/* routes and relays SSE events to Studio WebSocket.
 */

import { Hono } from "hono";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const DEFAULT_KADIMA_PORT = 4210;

function getKadimaUrl(): string {
  const root = process.env.OGU_ROOT || process.cwd();
  const configPath = join(root, ".ogu/kadima.config.json");
  let port = DEFAULT_KADIMA_PORT;
  let host = "127.0.0.1";

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      port = config.api?.port || DEFAULT_KADIMA_PORT;
      host = config.api?.host || "127.0.0.1";
    } catch { /* use defaults */ }
  }

  return `http://${host}:${port}`;
}

async function proxyGet(path: string): Promise<any> {
  const url = `${getKadimaUrl()}${path}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { error: `Kadima returned ${res.status}`, status: res.status };
    return await res.json();
  } catch (err: any) {
    return { error: "Kadima daemon not running", details: err.message, running: false };
  }
}

async function proxyPost(path: string, body: any): Promise<any> {
  const url = `${getKadimaUrl()}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { error: `Kadima returned ${res.status}`, status: res.status };
    return await res.json();
  } catch (err: any) {
    return { error: "Kadima daemon not running", details: err.message, running: false };
  }
}

export function createKadimaProxy() {
  const kadima = new Hono();

  // Health check
  kadima.get("/health", async (c) => {
    const result = await proxyGet("/health");
    return c.json(result);
  });

  // Dashboard — aggregated system snapshot
  kadima.get("/dashboard", async (c) => {
    const result = await proxyGet("/api/dashboard");
    return c.json(result);
  });

  // Scheduler status
  kadima.get("/scheduler", async (c) => {
    const result = await proxyGet("/api/scheduler/status");
    return c.json(result);
  });

  // Runner pool status
  kadima.get("/runners", async (c) => {
    const result = await proxyGet("/api/runners");
    return c.json(result);
  });

  // Features
  kadima.get("/features", async (c) => {
    const result = await proxyGet("/api/features");
    return c.json(result);
  });

  // Metrics
  kadima.get("/metrics", async (c) => {
    const result = await proxyGet("/api/metrics");
    return c.json(result);
  });

  // Budget
  kadima.get("/budget", async (c) => {
    const result = await proxyGet("/api/budget");
    return c.json(result);
  });

  // Task details
  kadima.get("/task/:taskId", async (c) => {
    const taskId = c.req.param("taskId");
    const result = await proxyGet(`/api/task/${taskId}`);
    return c.json(result);
  });

  // Enqueue tasks
  kadima.post("/enqueue", async (c) => {
    const body = await c.req.json();
    const result = await proxyPost("/api/enqueue", body);
    return c.json(result);
  });

  // Cancel task
  kadima.post("/task/:taskId/cancel", async (c) => {
    const taskId = c.req.param("taskId");
    const result = await proxyPost(`/api/task/${taskId}/cancel`, {});
    return c.json(result);
  });

  // Force scheduler tick
  kadima.post("/scheduler/tick", async (c) => {
    const result = await proxyPost("/api/scheduler/force-tick", {});
    return c.json(result);
  });

  // Execute CLI command via Kadima
  kadima.post("/command", async (c) => {
    const body = await c.req.json();
    const result = await proxyPost("/api/command", body);
    return c.json(result);
  });

  return kadima;
}
