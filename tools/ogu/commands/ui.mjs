/**
 * ogu ui — Launch the Kadima UI dev server
 *
 * In dev mode: starts Vite dev server (proxies /api → Kadima on 4210).
 * In production: Kadima daemon serves the built UI from ui/dist/.
 *
 * Usage:
 *   ogu ui            # Start UI dev server (default port 5173)
 *   ogu ui --port N   # Use custom port
 *   ogu ui --no-open  # Don't auto-open browser
 */

import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const kadimaDir = join(__dirname, "../../kadima");
const uiDir = join(kadimaDir, "ui");
const root = join(__dirname, "../../..");

export async function ui() {
  const args = process.argv.slice(3);
  const noOpen = args.includes("--no-open");
  const portIdx = args.indexOf("--port");
  const port = portIdx >= 0 ? parseInt(args[portIdx + 1], 10) : 5173;

  // Ensure dependencies are installed
  if (!existsSync(join(kadimaDir, "node_modules"))) {
    console.log("  Installing Kadima UI dependencies...");
    execSync("npm install", { cwd: kadimaDir, stdio: "inherit" });
    console.log("");
  }

  console.log(`  Starting Kadima UI on http://127.0.0.1:${port}`);
  console.log("  API: http://127.0.0.1:4210 (Kadima daemon must be running)");
  console.log("  Press Ctrl+C to stop\n");

  const vite = spawn("npx", ["vite", uiDir, "--port", String(port), "--host", "127.0.0.1"], {
    cwd: kadimaDir,
    stdio: "inherit",
    env: { ...process.env, OGU_ROOT: root },
  });

  if (!noOpen) {
    setTimeout(() => {
      const url = `http://127.0.0.1:${port}`;
      try {
        const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        execSync(`${cmd} ${url}`, { stdio: "ignore" });
      } catch { /* ignore if browser fails to open */ }
    }, 2000);
  }

  return new Promise((resolve) => {
    vite.on("exit", (code) => resolve(code || 0));
    process.on("SIGINT", () => { vite.kill(); resolve(0); });
  });
}
