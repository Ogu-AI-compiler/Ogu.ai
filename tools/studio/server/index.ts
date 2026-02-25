import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApiRouter } from "./api/router.js";
import { createExecRouter } from "./api/exec.js";
import { createChatRouter } from "./api/chat.js";
import { createBrandRouter } from "./api/brand.js";
import { setupWebSocket } from "./ws/server.js";
import { resolve, join } from "path";
import { existsSync, readFileSync } from "fs";

const args = process.argv.slice(2);
const isDev = args.includes("--dev");
const portFlag = args.indexOf("--port");
const port = portFlag >= 0 ? parseInt(args[portFlag + 1], 10) : 4200;

const studioRoot = resolve(import.meta.dirname || __dirname, "..");
const projectRoot = process.env.OGU_ROOT || resolve(studioRoot, "../../..");
process.env.OGU_ROOT = projectRoot;

const app = new Hono();

// API routes
app.route("/api", createApiRouter());
app.route("/api", createExecRouter());
app.route("/api", createChatRouter());
app.route("/api", createBrandRouter());

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

process.on("SIGINT", () => { server.close(); process.exit(0); });
process.on("SIGTERM", () => { server.close(); process.exit(0); });
