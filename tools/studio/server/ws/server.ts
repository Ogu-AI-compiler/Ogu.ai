import { WebSocketServer, WebSocket } from "ws";
import { watch } from "chokidar";
import { readFileSync } from "fs";
import { join, basename } from "path";
import type { Server } from "http";
import type { ServerEvent } from "./events.js";

const clients = new Set<WebSocket>();

export function setupWebSocket(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch { /* ignore malformed */ }
    });
  });

  // Watch .ogu/ directory for changes
  const root = process.env.OGU_ROOT || process.cwd();
  const oguDir = join(root, ".ogu");

  const watcher = watch(oguDir, {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });

  watcher.on("change", (filePath) => {
    const file = basename(filePath);
    try {
      const raw = readFileSync(filePath, "utf-8");
      const data = file.endsWith(".json") ? JSON.parse(raw) : raw;

      const event: ServerEvent = file === "THEME.json"
        ? { type: "theme:changed", themeData: data.generated_tokens || data }
        : { type: "state:changed", file, data };

      broadcast(event);
    } catch { /* ignore parse errors on partial writes */ }
  });

  // Watch project root for file changes (for live file tree)
  let filesDebounce: ReturnType<typeof setTimeout> | null = null;
  const IGNORE_DIRS = /node_modules|\.git|dist|\.ogu|\.claude/;

  const projectWatcher = watch(root, {
    ignoreInitial: true,
    depth: 3,
    ignored: (path) => IGNORE_DIRS.test(path),
    awaitWriteFinish: { stabilityThreshold: 300 },
  });

  const emitFilesChanged = () => {
    if (filesDebounce) clearTimeout(filesDebounce);
    filesDebounce = setTimeout(() => {
      broadcast({ type: "files:changed" });
    }, 500);
  };

  projectWatcher
    .on("add", emitFilesChanged)
    .on("unlink", emitFilesChanged)
    .on("addDir", emitFilesChanged)
    .on("unlinkDir", emitFilesChanged);

  return wss;
}

export function broadcast(event: ServerEvent) {
  const msg = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}
