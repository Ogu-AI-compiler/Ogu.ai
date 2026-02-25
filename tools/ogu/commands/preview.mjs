import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { repoRoot } from "../util.mjs";

const HEALTH_ENDPOINTS = [
  { name: "web", url: "http://localhost:3000/api/health" },
  { name: "mock-api", url: "http://localhost:4001/health" },
];

const MAX_WAIT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

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

  // Start services
  console.log("  starting services...");
  try {
    if (mode === "docker-compose") {
      execSync("docker compose up -d", { cwd: root, stdio: "pipe" });
    } else {
      // pnpm fallback — expects a "preview" script in root package.json
      const pkgPath = join(root, "package.json");
      if (!existsSync(pkgPath)) {
        console.error("  ERROR  No package.json found. Cannot run pnpm preview.");
        return 1;
      }
      execSync("pnpm preview &", { cwd: root, stdio: "pipe", shell: true });
    }
  } catch (err) {
    console.error(`  ERROR  Failed to start services: ${err.message}`);
    return 1;
  }

  // Wait for health
  console.log("  waiting for health checks...");
  const results = [];

  for (const endpoint of HEALTH_ENDPOINTS) {
    const healthy = await waitForHealth(endpoint.url, MAX_WAIT_MS, POLL_INTERVAL_MS);
    const status = healthy ? "UP" : "DOWN";
    results.push({ ...endpoint, status, healthy });
    console.log(`  ${endpoint.name.padEnd(12)} ${status} (${endpoint.url})`);
  }

  const allHealthy = results.every((r) => r.healthy);

  // Write report
  const report = buildReport(mode, results, allHealthy);
  const reportPath = join(root, ".ogu/PREVIEW.md");
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

async function waitForHealth(url, maxMs, intervalMs) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (resp.ok) return true;
    } catch {
      // not ready yet
    }
    await sleep(intervalMs);
  }
  return false;
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
