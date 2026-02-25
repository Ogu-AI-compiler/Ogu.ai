/**
 * ogu ports — Manage the global port registry.
 *
 * Subcommands:
 *   list                          Show all registered ports across all projects
 *   add <port> <service>          Register a port for the current project
 *   remove <port>                 Unregister a port from the current project
 *   scan                          Auto-detect ports from project config files
 *   register <project> <ports>    Register ports for a named project (JSON)
 *   clear                         Clear all ports for the current project
 *
 * The registry lives at ~/.ogu/port-registry.json and is read by Ogu Studio
 * to prevent new projects from claiming ports that belong to existing projects.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { repoRoot, globalRoot, readJsonSafe } from "../util.mjs";

const REGISTRY_PATH = join(globalRoot(), "port-registry.json");

/* ── Registry I/O ── */

function readRegistry() {
  if (!existsSync(REGISTRY_PATH)) return { projects: {} };
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  } catch {
    return { projects: {} };
  }
}

function writeRegistry(registry) {
  const dir = globalRoot();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
}

/* ── Port scanning — detect ports from project config files ── */

function scanProjectPorts(root) {
  const found = [];

  // 1. package.json scripts — look for --port, -p, PORT= patterns
  const pkg = readJsonSafe(join(root, "package.json"));
  if (pkg?.scripts) {
    for (const [name, script] of Object.entries(pkg.scripts)) {
      if (typeof script !== "string") continue;
      // Match patterns like: --port 3000, -p 3001, PORT=3002, :3000
      const portMatches = script.matchAll(/(?:--port\s+|(?:^|\s)-p\s+|PORT[=:]\s*|localhost:)(\d{4,5})/gi);
      for (const m of portMatches) {
        const port = parseInt(m[1], 10);
        if (port >= 1024 && port <= 65535) {
          found.push({ port, service: `script:${name}` });
        }
      }
    }
  }

  // 2. .env / .env.local — PORT=XXXX, NEXT_PUBLIC_API_PORT, etc.
  for (const envFile of [".env", ".env.local", ".env.development"]) {
    const envPath = join(root, envFile);
    if (!existsSync(envPath)) continue;
    const content = readFileSync(envPath, "utf-8");
    const portMatches = content.matchAll(/^[A-Z_]*PORT[A-Z_]*\s*=\s*(\d{4,5})/gm);
    for (const m of portMatches) {
      const port = parseInt(m[1], 10);
      if (port >= 1024 && port <= 65535) {
        const varName = m[0].split("=")[0].trim();
        found.push({ port, service: `env:${varName}` });
      }
    }
  }

  // 3. docker-compose.yml — ports: "XXXX:YYYY"
  for (const dcFile of ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"]) {
    const dcPath = join(root, dcFile);
    if (!existsSync(dcPath)) continue;
    const content = readFileSync(dcPath, "utf-8");
    const portMatches = content.matchAll(/["']?(\d{4,5}):\d{4,5}["']?/g);
    for (const m of portMatches) {
      const port = parseInt(m[1], 10);
      if (port >= 1024 && port <= 65535) {
        found.push({ port, service: "docker" });
      }
    }
  }

  // 4. Common framework config files
  const configPatterns = [
    { file: "next.config.js", pattern: /port\s*[:=]\s*(\d{4,5})/gi },
    { file: "next.config.mjs", pattern: /port\s*[:=]\s*(\d{4,5})/gi },
    { file: "next.config.ts", pattern: /port\s*[:=]\s*(\d{4,5})/gi },
    { file: "vite.config.ts", pattern: /port\s*[:=]\s*(\d{4,5})/gi },
    { file: "vite.config.js", pattern: /port\s*[:=]\s*(\d{4,5})/gi },
    { file: "nuxt.config.ts", pattern: /port\s*[:=]\s*(\d{4,5})/gi },
    { file: "angular.json", pattern: /"port"\s*:\s*(\d{4,5})/gi },
    { file: "svelte.config.js", pattern: /port\s*[:=]\s*(\d{4,5})/gi },
  ];
  for (const { file, pattern } of configPatterns) {
    const fp = join(root, file);
    if (!existsSync(fp)) continue;
    const content = readFileSync(fp, "utf-8");
    for (const m of content.matchAll(pattern)) {
      const port = parseInt(m[1], 10);
      if (port >= 1024 && port <= 65535) {
        found.push({ port, service: file });
      }
    }
  }

  // Deduplicate by port (keep first)
  const seen = new Set();
  return found.filter((f) => {
    if (seen.has(f.port)) return false;
    seen.add(f.port);
    return true;
  });
}

/* ── Subcommands ── */

function cmdList() {
  const registry = readRegistry();
  const projects = Object.entries(registry.projects);
  if (projects.length === 0) {
    console.log("No ports registered. Run 'ogu ports scan' to auto-detect.");
    return 0;
  }

  console.log("\n  Port Registry\n");
  let totalPorts = 0;
  for (const [projectPath, data] of projects) {
    const name = data.name || basename(projectPath);
    const ports = data.ports || {};
    const portEntries = Object.entries(ports);
    totalPorts += portEntries.length;

    console.log(`  ${name} (${projectPath})`);
    if (portEntries.length === 0) {
      console.log("    (no ports registered)");
    } else {
      for (const [port, service] of portEntries.sort((a, b) => Number(a[0]) - Number(b[0]))) {
        console.log(`    ${port}  ${service}`);
      }
    }
    console.log("");
  }
  console.log(`  ${totalPorts} ports across ${projects.length} projects\n`);
  return 0;
}

function cmdAdd() {
  const port = process.argv[4];
  const service = process.argv.slice(5).join(" ") || "unknown";
  if (!port || isNaN(Number(port))) {
    console.error("Usage: ogu ports add <port> <service>");
    return 1;
  }

  const root = repoRoot();
  const registry = readRegistry();
  if (!registry.projects[root]) {
    registry.projects[root] = { name: basename(root), ports: {}, updatedAt: new Date().toISOString() };
  }
  registry.projects[root].ports[port] = service;
  registry.projects[root].updatedAt = new Date().toISOString();
  writeRegistry(registry);
  console.log(`Registered port ${port} (${service}) for ${basename(root)}`);
  return 0;
}

function cmdRemove() {
  const port = process.argv[4];
  if (!port) {
    console.error("Usage: ogu ports remove <port>");
    return 1;
  }

  const root = repoRoot();
  const registry = readRegistry();
  if (registry.projects[root]?.ports?.[port]) {
    delete registry.projects[root].ports[port];
    registry.projects[root].updatedAt = new Date().toISOString();
    writeRegistry(registry);
    console.log(`Removed port ${port} from ${basename(root)}`);
  } else {
    console.log(`Port ${port} not registered for ${basename(root)}`);
  }
  return 0;
}

function cmdScan() {
  const root = repoRoot();
  const name = basename(root);
  console.log(`Scanning ${name} for port usage...`);

  const detected = scanProjectPorts(root);
  if (detected.length === 0) {
    console.log("No ports detected in config files.");
    console.log("Tip: use 'ogu ports add <port> <service>' to register manually.");
    return 0;
  }

  const registry = readRegistry();
  if (!registry.projects[root]) {
    registry.projects[root] = { name, ports: {}, updatedAt: new Date().toISOString() };
  }

  let added = 0;
  for (const { port, service } of detected) {
    if (!registry.projects[root].ports[String(port)]) {
      registry.projects[root].ports[String(port)] = service;
      added++;
    }
    console.log(`  ${port}  ${service}${registry.projects[root].ports[String(port)] === service ? "" : " (already registered)"}`);
  }

  registry.projects[root].updatedAt = new Date().toISOString();
  writeRegistry(registry);
  console.log(`\nRegistered ${added} new port(s) for ${name}`);
  return 0;
}

function cmdRegister() {
  // ogu ports register "/path/to/project" '{"3000":"Web","3001":"API"}'
  const projectPath = process.argv[4];
  const portsJson = process.argv[5];
  if (!projectPath || !portsJson) {
    console.error('Usage: ogu ports register "/path/to/project" \'{"3000":"Web","3001":"API"}\'');
    return 1;
  }

  let ports;
  try {
    ports = JSON.parse(portsJson);
  } catch {
    console.error("Invalid JSON for ports");
    return 1;
  }

  const absPath = resolve(projectPath);
  const registry = readRegistry();
  registry.projects[absPath] = {
    name: basename(absPath),
    ports,
    updatedAt: new Date().toISOString(),
  };
  writeRegistry(registry);

  const count = Object.keys(ports).length;
  console.log(`Registered ${count} port(s) for ${basename(absPath)}`);
  return 0;
}

function cmdClear() {
  const root = repoRoot();
  const registry = readRegistry();
  if (registry.projects[root]) {
    delete registry.projects[root];
    writeRegistry(registry);
    console.log(`Cleared all ports for ${basename(root)}`);
  } else {
    console.log(`No ports registered for ${basename(root)}`);
  }
  return 0;
}

/* ── Main ── */

export async function ports() {
  const sub = process.argv[3];

  switch (sub) {
    case "list":
    case undefined:
      return cmdList();
    case "add":
      return cmdAdd();
    case "remove":
      return cmdRemove();
    case "scan":
      return cmdScan();
    case "register":
      return cmdRegister();
    case "clear":
      return cmdClear();
    default:
      console.error(`Unknown subcommand: ${sub}`);
      console.log("Usage: ogu ports [list|add|remove|scan|register|clear]");
      return 1;
  }
}
