import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../util.mjs";

const SIGNALS = {
  needs_db: [
    "packages/db",
    "prisma/schema.prisma",
    "docker-compose.yml:postgres",
    "docker-compose.yml:database",
  ],
  needs_jobs: [
    "docker-compose.yml:redis",
    "docker-compose.yml:worker",
    "package.json:bullmq",
  ],
  needs_storage: [
    "package.json:@aws-sdk/client-s3",
    "package.json:minio",
  ],
  needs_realtime: [
    "package.json:socket.io",
    "package.json:ws",
    "package.json:pusher",
  ],
  needs_auth: [
    "package.json:next-auth",
    "package.json:auth.js",
    "package.json:jsonwebtoken",
    "package.json:bcrypt",
    "package.json:passport",
  ],
  needs_video: [
    "package.json:@mux",
    "package.json:mux-node",
    "package.json:cloudflare-stream",
  ],
  needs_search: [
    "package.json:elasticsearch",
    "package.json:@elastic",
    "package.json:opensearch",
    "package.json:meilisearch",
    "package.json:algolia",
  ],
};

export async function profile() {
  const root = repoRoot();

  // Detect platform
  const hasWeb = existsSync(join(root, "apps/web"));
  const hasMobile = existsSync(join(root, "apps/mobile"));
  let platform = "web";
  if (hasWeb && hasMobile) platform = "web+mobile";
  else if (hasMobile && !hasWeb) platform = "mobile";

  // Detect services
  const services = [];
  if (hasWeb) services.push("web");
  if (existsSync(join(root, "apps/api"))) services.push("api");
  if (existsSync(join(root, "apps/mock-api"))) services.push("mock-api");

  // Read compose file for additional service detection
  const composeContent = readCompose(root);

  // Read all package.json files for dependency detection
  const allDeps = collectDependencies(root);

  // Detect needs
  const needs = {};
  for (const [key, signals] of Object.entries(SIGNALS)) {
    needs[key] = signals.some((sig) => matchSignal(root, sig, composeContent, allDeps));
  }

  // Add detected infra services
  if (needs.needs_db) services.push("db");
  if (needs.needs_jobs) services.push("redis");

  const result = {
    platform,
    ...needs,
    services,
  };

  const profilePath = join(root, ".ogu/PROFILE.json");
  writeFileSync(profilePath, JSON.stringify(result, null, 2) + "\n", "utf-8");

  console.log(`  platform ${platform}`);
  for (const [key, val] of Object.entries(needs)) {
    if (val) console.log(`  ${key.padEnd(16)} yes`);
  }
  console.log(`  services ${services.join(", ")}`);
  console.log(`  profile  .ogu/PROFILE.json`);

  return 0;
}

// ---------------------------------------------------------------------------

function readCompose(root) {
  const p = join(root, "docker-compose.yml");
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf-8").toLowerCase();
}

function collectDependencies(root) {
  const deps = new Set();
  const pkgPaths = findPackageJsons(root);
  for (const p of pkgPaths) {
    try {
      const pkg = JSON.parse(readFileSync(p, "utf-8"));
      for (const section of ["dependencies", "devDependencies"]) {
        if (pkg[section]) {
          for (const name of Object.keys(pkg[section])) {
            deps.add(name);
          }
        }
      }
    } catch { /* skip */ }
  }
  return deps;
}

function findPackageJsons(root) {
  const results = [];
  const rootPkg = join(root, "package.json");
  if (existsSync(rootPkg)) results.push(rootPkg);

  for (const dir of ["apps", "packages"]) {
    const base = join(root, dir);
    if (!existsSync(base)) continue;
    try {
      for (const sub of readdirSync(base)) {
        const pkg = join(base, sub, "package.json");
        if (existsSync(pkg)) results.push(pkg);
      }
    } catch { /* skip */ }
  }
  return results;
}

function matchSignal(root, signal, composeContent, allDeps) {
  // Directory existence check
  if (!signal.includes(":") && !signal.includes(".")) {
    return existsSync(join(root, signal));
  }

  // File existence check (like prisma/schema.prisma)
  if (!signal.includes(":")) {
    return existsSync(join(root, signal));
  }

  const [source, keyword] = signal.split(":");

  // docker-compose.yml signal
  if (source === "docker-compose.yml") {
    return composeContent.includes(keyword);
  }

  // package.json dependency signal
  if (source === "package.json") {
    return allDeps.has(keyword);
  }

  return false;
}
