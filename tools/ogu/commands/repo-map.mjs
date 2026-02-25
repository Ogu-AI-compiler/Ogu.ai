import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { repoRoot } from "../util.mjs";

const IGNORE = new Set([
  ".git", "node_modules", ".ogu", "dist", "build", ".next", ".nuxt",
  ".cache", ".turbo", "coverage", ".venv", "venv", "__pycache__",
  ".DS_Store", "Thumbs.db",
]);

export async function repoMap() {
  const root = repoRoot();

  const entries = scanTopLevel(root);
  const stack = detectStack(root, entries);
  const entrypoints = detectEntrypoints(root, entries, stack);
  const directories = describeDirectories(root, entries);

  const content = render(entrypoints, stack, directories);

  const mapPath = join(root, "docs/vault/01_Architecture/Repo_Map.md");
  writeFileSync(mapPath, content, "utf-8");

  // Update STATE.json
  const statePath = join(root, ".ogu/STATE.json");
  if (existsSync(statePath)) {
    try {
      const state = JSON.parse(readFileSync(statePath, "utf-8"));
      state.last_repo_map_update = new Date().toISOString();
      writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
    } catch { /* leave STATE.json as-is if unparseable */ }
  }

  console.log("  updated  docs/vault/01_Architecture/Repo_Map.md");
  return 0;
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

function scanTopLevel(root) {
  return readdirSync(root)
    .filter((name) => !IGNORE.has(name) && !name.startsWith("."))
    .map((name) => {
      const full = join(root, name);
      const stat = statSync(full);
      return { name, isDir: stat.isDirectory(), full };
    });
}

function listShallow(dirPath, depth = 1, prefix = "") {
  if (!existsSync(dirPath)) return [];
  const items = [];
  for (const name of readdirSync(dirPath)) {
    if (IGNORE.has(name) || name.startsWith(".")) continue;
    const full = join(dirPath, name);
    const stat = statSync(full);
    const rel = prefix ? `${prefix}/${name}` : name;
    items.push({ name: rel, isDir: stat.isDirectory() });
    if (stat.isDirectory() && depth > 1) {
      items.push(...listShallow(full, depth - 1, rel));
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function detectStack(root, entries) {
  const hints = [];
  const fileNames = entries.map((e) => e.name);

  // Package manager
  if (fileNames.includes("bun.lockb")) hints.push("Bun");
  else if (fileNames.includes("pnpm-lock.yaml")) hints.push("pnpm");
  else if (fileNames.includes("yarn.lock")) hints.push("Yarn");
  else if (fileNames.includes("package-lock.json")) hints.push("npm");

  // Language / runtime
  if (fileNames.includes("package.json")) {
    hints.push("Node.js");
    const pkg = readJsonSafe(join(root, "package.json"));
    if (pkg) {
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps["next"]) hints.push("Next.js");
      if (allDeps["react"]) hints.push("React");
      if (allDeps["vue"]) hints.push("Vue");
      if (allDeps["svelte"]) hints.push("Svelte");
      if (allDeps["express"]) hints.push("Express");
      if (allDeps["fastify"]) hints.push("Fastify");
      if (allDeps["typescript"]) hints.push("TypeScript");
      if (allDeps["tailwindcss"]) hints.push("Tailwind CSS");
      if (allDeps["prisma"] || allDeps["@prisma/client"]) hints.push("Prisma");
      if (allDeps["drizzle-orm"]) hints.push("Drizzle");
    }
  }
  if (fileNames.includes("tsconfig.json")) hints.push("TypeScript");
  if (fileNames.includes("requirements.txt") || fileNames.includes("pyproject.toml")) hints.push("Python");
  if (fileNames.includes("go.mod")) hints.push("Go");
  if (fileNames.includes("Cargo.toml")) hints.push("Rust");
  if (fileNames.includes("Gemfile")) hints.push("Ruby");
  if (fileNames.includes("Dockerfile") || fileNames.includes("docker-compose.yml")) hints.push("Docker");

  // Monorepo
  if (fileNames.includes("turbo.json")) hints.push("Turborepo");
  if (fileNames.includes("nx.json")) hints.push("Nx");
  if (fileNames.includes("lerna.json")) hints.push("Lerna");
  if (existsSync(join(root, "packages")) || existsSync(join(root, "apps"))) hints.push("Monorepo");

  return [...new Set(hints)];
}

function detectEntrypoints(root, entries, stack) {
  const points = [];
  const fileNames = entries.map((e) => e.name);

  // CLI tools
  if (existsSync(join(root, "tools/ogu/cli.mjs"))) {
    points.push({ name: "tools/ogu/cli.mjs", desc: "Ogu CLI — memory and validation system" });
  }

  // package.json scripts
  if (fileNames.includes("package.json")) {
    const pkg = readJsonSafe(join(root, "package.json"));
    if (pkg?.scripts) {
      const notable = ["start", "dev", "build", "serve", "test"];
      for (const key of notable) {
        if (pkg.scripts[key]) {
          points.push({ name: `npm run ${key}`, desc: pkg.scripts[key] });
        }
      }
    }
    if (pkg?.bin) {
      for (const [cmd, path] of Object.entries(pkg.bin)) {
        points.push({ name: cmd, desc: `CLI binary → ${path}` });
      }
    }
  }

  // Common entrypoints
  for (const candidate of ["src/index.ts", "src/index.js", "src/main.ts", "src/main.js", "index.ts", "index.js", "app.ts", "app.js", "main.go", "main.py"]) {
    if (existsSync(join(root, candidate))) {
      points.push({ name: candidate, desc: "Application entrypoint" });
    }
  }

  // Monorepo apps/packages
  for (const dir of ["apps", "packages"]) {
    const full = join(root, dir);
    if (existsSync(full) && statSync(full).isDirectory()) {
      for (const sub of readdirSync(full)) {
        if (IGNORE.has(sub) || sub.startsWith(".")) continue;
        const subFull = join(full, sub);
        if (statSync(subFull).isDirectory()) {
          const subPkg = readJsonSafe(join(subFull, "package.json"));
          const desc = subPkg?.description || subPkg?.name || sub;
          points.push({ name: `${dir}/${sub}`, desc });
        }
      }
    }
  }

  return points;
}

function describeDirectories(root, entries) {
  const dirs = [];

  for (const entry of entries) {
    if (!entry.isDir) continue;
    const desc = guessDirectoryPurpose(entry.name, entry.full);
    const children = listShallow(entry.full, 1)
      .filter((c) => c.isDir)
      .map((c) => c.name);
    dirs.push({ name: entry.name, desc, children });
  }

  return dirs;
}

const DIR_HINTS = {
  src: "Application source code",
  lib: "Library code",
  tools: "Developer tooling and scripts",
  docs: "Documentation and knowledge vault",
  test: "Test files", tests: "Test files",
  scripts: "Build and automation scripts",
  config: "Configuration files",
  public: "Static assets served publicly",
  assets: "Static assets",
  templates: "Template files",
  output: "Generated output",
  apps: "Monorepo application packages",
  packages: "Monorepo shared packages",
  services: "Backend services",
  api: "API layer",
  components: "UI components",
  pages: "Page-level components or routes",
  styles: "Stylesheets",
  migrations: "Database migrations",
  prisma: "Prisma schema and migrations",
};

function guessDirectoryPurpose(name, fullPath) {
  if (DIR_HINTS[name]) return DIR_HINTS[name];

  // Check for package.json description
  const pkg = readJsonSafe(join(fullPath, "package.json"));
  if (pkg?.description) return pkg.description;

  // Check for README
  const readme = join(fullPath, "README.md");
  if (existsSync(readme)) {
    const first = readFileSync(readme, "utf-8").split("\n").find((l) => l.trim() && !l.startsWith("#"));
    if (first) return first.trim().slice(0, 80);
  }

  return "Project directory";
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render(entrypoints, stack, directories) {
  let md = "# Repo Map\n\n";
  md += `> Auto-generated by \`ogu repo-map\`. Do not edit manually.\n\n`;

  // Stack
  if (stack.length > 0) {
    md += "## Tech Stack\n\n";
    md += stack.map((s) => `- ${s}`).join("\n") + "\n\n";
  }

  // Entrypoints
  md += "## Entrypoints\n\n";
  if (entrypoints.length === 0) {
    md += "No entrypoints detected.\n\n";
  } else {
    md += "| Entry | Description |\n|---|---|\n";
    md += entrypoints.map((e) => `| \`${e.name}\` | ${e.desc} |`).join("\n") + "\n\n";
  }

  // Directories
  md += "## Directories\n\n";
  if (directories.length === 0) {
    md += "No directories found.\n\n";
  } else {
    for (const dir of directories) {
      md += `### \`${dir.name}/\`\n`;
      md += `${dir.desc}\n`;
      if (dir.children.length > 0) {
        md += "\nSubdirectories: " + dir.children.map((c) => `\`${c}\``).join(", ") + "\n";
      }
      md += "\n";
    }
  }

  return md;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}
