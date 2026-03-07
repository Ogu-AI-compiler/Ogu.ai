import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { repoRoot } from "../util.mjs";
import { resolveOguPath, resolveRuntimePath } from "./lib/runtime-paths.mjs";

const MAX_WAIT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

/**
 * Detect health endpoints dynamically from project configuration.
 * Reads package.json, vite.config, .ogu/PROFILE.json to determine
 * what services the project actually runs and at which ports.
 */
function buildHealthEndpoints(root) {
  const endpoints = [];

  // 1. Read package.json
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) return endpoints;
  let pkg;
  try { pkg = JSON.parse(readFileSync(pkgPath, "utf8")); } catch { return endpoints; }
  const scripts = pkg.scripts || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  // 2. Detect framework
  const isVite = "vite" in (deps || {}) || scripts.dev?.includes("vite");
  const isNext = "next" in (deps || {}) || scripts.dev?.includes("next");

  // 3. Detect preview port from vite config
  let vitePreviewPort = 4173; // vite preview default
  for (const cfg of ["vite.config.ts", "vite.config.js", "vite.config.mjs"]) {
    const cfgPath = join(root, cfg);
    if (existsSync(cfgPath)) {
      try {
        const content = readFileSync(cfgPath, "utf8");
        const previewPortMatch = content.match(/preview\s*:\s*\{[^}]*port\s*:\s*(\d+)/);
        if (previewPortMatch) vitePreviewPort = parseInt(previewPortMatch[1]);
      } catch { /* skip */ }
      break;
    }
  }

  // 4. Build endpoints based on detected framework
  if (isVite) {
    endpoints.push({
      name: "web",
      urls: [
        `http://localhost:${vitePreviewPort}/`,
        "http://localhost:5173/",
        "http://localhost:3000/",
      ],
    });
  } else if (isNext) {
    endpoints.push({
      name: "web",
      urls: [
        "http://localhost:3000/",
        "http://localhost:3000/api/health",
      ],
    });
  } else {
    // Generic — try common ports
    endpoints.push({
      name: "web",
      urls: [
        "http://localhost:3000/",
        "http://localhost:3000/api/health",
        "http://localhost:8080/",
        "http://localhost:5173/",
      ],
    });
  }

  // 5. Only add mock-api if explicitly configured
  const hasMockApi = scripts["mock-api"] || scripts["mock"] || scripts["start:api"]
    || "json-server" in (deps || {});
  if (hasMockApi) {
    endpoints.push({
      name: "mock-api",
      urls: [
        "http://localhost:4001/health",
        "http://localhost:4001/",
      ],
    });
  }

  // 6. Read PROFILE.json for additional services (populated by `ogu profile`)
  const profilePath = resolveOguPath(root, "PROFILE.json");
  if (existsSync(profilePath)) {
    try {
      const profile = JSON.parse(readFileSync(profilePath, "utf8"));
      for (const svc of (profile.services || [])) {
        if (svc.port && !endpoints.some(e => e.name === svc.name)) {
          endpoints.push({
            name: svc.name,
            urls: [
              `http://localhost:${svc.port}/health`,
              `http://localhost:${svc.port}/`,
            ],
          });
        }
      }
    } catch { /* skip */ }
  }

  return endpoints;
}

export async function preview() {
  const args = process.argv.slice(3);
  const root = repoRoot();

  // Handle --stop
  if (args.includes("--stop")) {
    return stopPreview(root);
  }

  // Detect mode
  const composePath = join(root, "docker-compose.yml");
  const hasCompose = existsSync(composePath);
  const mode = hasCompose ? "docker-compose" : "pnpm";

  console.log(`  mode     ${mode}`);

  // Check prerequisites
  if (mode === "docker-compose") {
    if (!commandExists("docker")) {
      console.error("  ERROR  Docker is not installed. Install Docker Desktop or use pnpm preview as fallback.");
      return 1;
    }
  }

  // Build endpoints BEFORE starting services
  const healthEndpoints = buildHealthEndpoints(root);
  if (healthEndpoints.length === 0) {
    console.error("  ERROR  Could not detect any services to check. Ensure package.json exists.");
    return 1;
  }

  // For pnpm mode: build first, then start preview
  if (mode !== "docker-compose") {
    const pkgPath = join(root, "package.json");
    if (!existsSync(pkgPath)) {
      console.error("  ERROR  No package.json found. Cannot run pnpm preview.");
      return 1;
    }

    // Clean stale .js duplicates — agents write .ts/.tsx but old .js files remain
    // Vite/Rollup may pick up .js over .ts, causing JSX parse errors
    cleanStaleDuplicates(root);

    // Install dependencies only if node_modules is missing or key packages are absent
    const nodeModulesDir = join(root, "node_modules");
    const needsInstall = !existsSync(nodeModulesDir)
      || !existsSync(join(nodeModulesDir, ".pnpm"))
      || !existsSync(join(nodeModulesDir, "vite")) && !existsSync(join(nodeModulesDir, "react"));
    if (needsInstall) {
      console.log("  installing dependencies...");
      try {
        execSync("pnpm install --no-frozen-lockfile", { cwd: root, stdio: "pipe", timeout: 90_000 });
      } catch (err) {
        const out = (err.stderr?.toString() || '').slice(-200);
        if (out) console.log(`  install warning: ${out}`);
      }
    }

    // Build step — vite preview requires dist/
    // Always rebuild to pick up latest agent changes
    console.log("  building app...");
    try {
      execSync("pnpm build", { cwd: root, stdio: "pipe", timeout: 120_000 });
    } catch (err) {
      const output = (err.stderr?.toString() || err.stdout?.toString() || err.message).slice(-2000);
      console.error(`  ERROR  Build failed:\n${output}`);
      return 1;
    }
  }

  // Start services
  console.log("  starting services...");

  let previewChild = null;
  let detectedPort = null;

  try {
    if (mode === "docker-compose") {
      execSync("docker compose up -d", { cwd: root, stdio: "pipe" });
    } else {
      // Kill any existing vite preview processes first
      try { execSync("pkill -f 'vite preview'", { stdio: "pipe" }); } catch { /* none running */ }

      // Start preview with spawn to capture the actual port
      const { spawn: spawnAsync } = await import("node:child_process");
      previewChild = spawnAsync("pnpm", ["preview"], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });
      previewChild.unref();

      // Wait up to 10s for the port line in stdout
      detectedPort = await new Promise((resolve) => {
        let buf = "";
        const timer = setTimeout(() => resolve(null), 10000);
        previewChild.stdout.on("data", (chunk) => {
          buf += chunk.toString();
          const match = buf.match(/localhost:(\d+)/);
          if (match) {
            clearTimeout(timer);
            resolve(parseInt(match[1]));
          }
        });
        previewChild.on("error", () => { clearTimeout(timer); resolve(null); });
      });

      if (detectedPort) {
        console.log(`  preview server on port ${detectedPort}`);
        // Override health endpoints with the detected port
        for (const ep of healthEndpoints) {
          if (ep.name === "web") {
            ep.urls = [`http://localhost:${detectedPort}/`, ...ep.urls];
          }
        }
      }
    }
  } catch (err) {
    console.error(`  ERROR  Failed to start services: ${err.message}`);
    return 1;
  }

  // Wait for health — try multiple URLs per endpoint, first hit = UP
  console.log("  waiting for health checks...");
  const results = [];

  for (const endpoint of healthEndpoints) {
    const { healthy, url: hitUrl } = await waitForHealthMulti(endpoint.urls, MAX_WAIT_MS, POLL_INTERVAL_MS);
    const status = healthy ? "UP" : "DOWN";
    const displayUrl = hitUrl || endpoint.urls[0];
    results.push({ name: endpoint.name, url: displayUrl, status, healthy });
    console.log(`  ${endpoint.name.padEnd(12)} ${status} (${displayUrl})`);
  }

  const allHealthy = results.every((r) => r.healthy);

  // Stop preview server after health check
  if (previewChild) {
    try { process.kill(-previewChild.pid); } catch { /* already dead */ }
  }
  try { execSync("pkill -f 'vite preview'", { stdio: "pipe" }); } catch { /* none running */ }

  // Write report
  const report = buildReport(mode, results, allHealthy);
  const reportPath = resolveRuntimePath(root, "PREVIEW.md");
  writeFileSync(reportPath, report, "utf-8");

  console.log("");
  if (allHealthy) {
    console.log("Preview: HEALTHY");
  } else {
    const failed = results.filter((r) => !r.healthy).map((r) => r.name);
    console.log(`Preview: FAILED (${failed.join(", ")} not reachable)`);
  }
  console.log(`  report   .ogu/PREVIEW.md`);

  return allHealthy ? 0 : 1;
}

// ---------------------------------------------------------------------------

function stopPreview(root) {
  const composePath = join(root, "docker-compose.yml");
  if (existsSync(composePath) && commandExists("docker")) {
    try {
      execSync("docker compose down", { cwd: root, stdio: "pipe" });
      console.log("  stopped  docker compose services");
      return 0;
    } catch (err) {
      console.error(`  ERROR  Failed to stop: ${err.message}`);
      return 1;
    }
  }
  console.log("  nothing to stop (no docker-compose.yml or Docker not installed)");
  return 0;
}

async function waitForHealthMulti(urls, maxMs, intervalMs) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    for (const url of urls) {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (resp.ok || resp.status === 304) return { healthy: true, url };
      } catch {
        // not ready yet
      }
    }
    await sleep(intervalMs);
  }
  return { healthy: false, url: null };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove stale .js files when a .ts or .tsx counterpart exists.
 * Agents produce .ts/.tsx but earlier runs may have left .js files that shadow them.
 */
function cleanStaleDuplicates(root) {
  const srcDir = join(root, "src");
  if (!existsSync(srcDir)) return;
  let removed = 0;

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const base = fullPath.slice(0, -3);
        if (existsSync(base + ".ts") || existsSync(base + ".tsx")) {
          try { unlinkSync(fullPath); removed++; } catch { /* skip */ }
        }
      }
    }
  }

  walk(srcDir);
  if (removed > 0) {
    console.log(`  cleaned ${removed} stale .js file(s) (shadowed by .ts/.tsx)`);
  }
}

function buildReport(mode, results, healthy) {
  const now = new Date().toISOString();
  let md = `# Preview Report\n\n`;
  md += `Built: ${now}\n`;
  md += `Mode: ${mode}\n`;

  md += `\n## Services\n`;
  for (const r of results) {
    md += `- ${r.name}: ${r.status} (${r.url})\n`;
  }

  md += `\n## Health Checks\n`;
  for (const r of results) {
    md += `- ${r.name}: ${r.healthy ? "OK" : "FAILED"}\n`;
  }

  md += `\n## Result\n${healthy ? "HEALTHY" : "FAILED"}\n`;
  return md;
}
