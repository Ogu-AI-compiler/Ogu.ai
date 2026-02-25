/**
 * ogu studio — Launch the Ogu Studio local web dashboard
 *
 * Opens a browser-based UI at localhost:4200 that runs all CLI
 * commands behind the scenes via child_process.
 *
 * Usage:
 *   ogu studio            # Start Studio (installs deps if needed)
 *   ogu studio --port N   # Use custom port
 *   ogu studio --no-open  # Don't auto-open browser
 */

import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioDir = join(__dirname, "../../studio");
const root = join(__dirname, "../../..");

export async function studio() {
  const args = process.argv.slice(3);
  const noOpen = args.includes("--no-open");
  const portIdx = args.indexOf("--port");
  const port = portIdx >= 0 ? parseInt(args[portIdx + 1], 10) : 4200;

  // Ensure dependencies are installed
  if (!existsSync(join(studioDir, "node_modules"))) {
    console.log("  Installing Studio dependencies...");
    execSync("npm install", { cwd: studioDir, stdio: "inherit" });
    console.log("");
  }

  console.log(`  Starting Ogu Studio on http://127.0.0.1:${port}`);
  console.log("  Press Ctrl+C to stop\n");

  // Start Vite dev server (frontend) and API server in parallel
  const vite = spawn("npx", ["vite", "--port", String(port + 1), "--host", "127.0.0.1"], {
    cwd: studioDir,
    stdio: "inherit",
    env: { ...process.env, OGU_ROOT: root },
  });

  const server = spawn("npx", ["tsx", "server/index.ts", "--dev", "--port", String(port)], {
    cwd: studioDir,
    stdio: "inherit",
    env: { ...process.env, OGU_ROOT: root },
  });

  // Open browser after a brief delay
  if (!noOpen) {
    setTimeout(() => {
      const url = `http://127.0.0.1:${port + 1}`;
      try {
        const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        execSync(`${cmd} ${url}`, { stdio: "ignore" });
      } catch { /* ignore if browser fails to open */ }
    }, 2000);
  }

  // Wait for either process to exit
  return new Promise((resolve) => {
    const cleanup = (code) => {
      vite.kill();
      server.kill();
      resolve(code || 0);
    };
    vite.on("exit", cleanup);
    server.on("exit", cleanup);
    process.on("SIGINT", () => cleanup(0));
  });
}
