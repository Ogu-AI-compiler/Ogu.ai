import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, extname, relative } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { repoRoot, readJsonSafe } from "../util.mjs";
import { createDepGraph } from "./lib/dep-graph-analyzer.mjs";
import { detectCycles } from "./lib/circular-dep-detector.mjs";

const require = createRequire(import.meta.url);

const SOURCE_DIRS = ["src", "apps", "packages", "lib"];
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const STYLE_EXTS = new Set([".css", ".scss", ".less", ".sass"]);
const IGNORE_DIRS = new Set(["node_modules", ".next", "dist", "build", ".ogu", ".git", ".claude"]);

export async function graph() {
  const root = repoRoot();
  const method = detectMethod(root);

  console.log(`  method   ${method}`);

  let edges;
  if (method === "ts-compiler-api") {
    edges = buildGraphTS(root);
  } else {
    edges = buildGraphRegex(root);
  }

  // Build reverse adjacency
  const reverse = {};
  for (const edge of edges) {
    if (!reverse[edge.to]) reverse[edge.to] = [];
    reverse[edge.to].push(edge.from);
  }

  // Wire dep-graph-analyzer (Phase 3D)
  const depGraph = createDepGraph();
  for (const edge of edges) {
    depGraph.addEdge(edge.from, edge.to);
  }

  // Wire circular-dep-detector (Phase 3D)
  const adjList = {};
  for (const edge of edges) {
    if (!adjList[edge.from]) adjList[edge.from] = [];
    adjList[edge.from].push(edge.to);
  }
  const cycles = detectCycles(adjList);

  // Count unique files
  const allFiles = new Set();
  for (const edge of edges) {
    allFiles.add(edge.from);
    allFiles.add(edge.to);
  }

  // Count by type
  const typeCounts = {};
  for (const edge of edges) {
    typeCounts[edge.type] = (typeCounts[edge.type] || 0) + 1;
  }

  const result = {
    version: 2,
    built_at: new Date().toISOString(),
    files_scanned: allFiles.size,
    method,
    edges,
    reverse,
    cycles: cycles.length,
    cycleDetails: cycles.slice(0, 10),
  };

  const graphPath = join(root, ".ogu/GRAPH.json");
  writeFileSync(graphPath, JSON.stringify(result, null, 2) + "\n", "utf-8");

  console.log(`  files    ${allFiles.size}`);
  console.log(`  edges    ${edges.length}`);
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`    ${type.padEnd(10)} ${count}`);
  }
  if (cycles.length > 0) {
    console.log(`  cycles   ${cycles.length} circular dep(s) detected`);
    for (const cycle of cycles.slice(0, 3)) {
      console.log(`    ${cycle.join(' → ')}`);
    }
  } else {
    console.log(`  cycles   none detected`);
  }
  console.log(`  graph    .ogu/GRAPH.json`);

  return 0;
}

// ---------------------------------------------------------------------------

function detectMethod(root) {
  try {
    const tsPath = join(root, "node_modules/typescript/lib/typescript.js");
    if (existsSync(tsPath)) {
      return "ts-compiler-api";
    }
  } catch { /* ignore */ }
  return "regex-fallback";
}

function buildGraphTS(root) {
  const edges = [];
  try {
    const tsPath = join(root, "node_modules/typescript/lib/typescript.js");
    const ts = require(tsPath);

    const configPath = findTsConfig(root);
    if (!configPath) {
      console.log("  warn     No tsconfig.json found, falling back to regex");
      return buildGraphRegex(root);
    }

    const configFile = ts.readConfigFile(configPath, (p) => readFileSync(p, "utf-8"));
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath));
    const program = ts.createProgram(parsed.fileNames, parsed.options);

    for (const sourceFile of program.getSourceFiles()) {
      const fileName = sourceFile.fileName;
      if (fileName.includes("node_modules")) continue;

      const relFrom = relative(root, fileName);
      if (relFrom.startsWith("..")) continue;

      ts.forEachChild(sourceFile, function visit(node) {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier
        ) {
          const specifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, "");
          const resolved = resolveSpecifier(root, fileName, specifier, parsed.options);
          if (resolved) {
            const type = STYLE_EXTS.has(extname(resolved)) ? "style" : "static";
            edges.push({ from: relFrom, to: resolved, confidence: "high", type });
          }
        }
        ts.forEachChild(node, visit);
      });

      // Extract additional edge types from file content
      const content = sourceFile.text || readFileSync(fileName, "utf-8");
      extractAdditionalEdges(content, relFrom, root, edges);
    }
  } catch (err) {
    console.log(`  warn     TS Compiler API failed: ${err.message}`);
    console.log("  warn     Falling back to regex");
    return buildGraphRegex(root);
  }
  return edges;
}

function buildGraphRegex(root) {
  const edges = [];
  const sourceFiles = collectSourceFiles(root);
  const aliases = loadPathAliases(root);

  for (const absPath of sourceFiles) {
    const relFrom = relative(root, absPath);
    const content = readFileSync(absPath, "utf-8");

    // Static imports
    const imports = extractImports(content);
    for (const specifier of imports) {
      const resolved = resolveImportRegex(root, absPath, specifier, aliases);
      if (resolved) {
        const type = STYLE_EXTS.has(extname(resolved)) ? "style" : "static";
        edges.push({ from: relFrom, to: resolved, confidence: "medium", type });
      }
    }

    // Additional edge types
    extractAdditionalEdges(content, relFrom, root, edges);
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Additional edge types (dynamic, style, api, config)
// ---------------------------------------------------------------------------

function extractAdditionalEdges(content, relFrom, root, edges) {
  // Dynamic imports — not already caught by static import extraction
  const dynamicPatterns = [
    /(?:await\s+)?import\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  ];

  for (const pattern of dynamicPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const spec = match[1];
      // Skip if it's a node_modules import
      if (!spec.startsWith(".") && !spec.startsWith("@/") && !spec.startsWith("~/")) continue;
      // Check if already tracked as static
      const alreadyTracked = edges.some(
        (e) => e.from === relFrom && e.to?.includes(spec.replace(/^\.\//, ""))
      );
      if (!alreadyTracked) {
        edges.push({ from: relFrom, to: spec, confidence: "medium", type: "dynamic" });
      }
    }
  }

  // Style imports (CSS/SCSS/LESS)
  const stylePatterns = [
    /import\s+['"]([^'"]+\.(css|scss|less|sass))['"]/g,
    /require\(\s*['"]([^'"]+\.(css|scss|less|sass))['"]\s*\)/g,
  ];

  for (const pattern of stylePatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const spec = match[1];
      const alreadyTracked = edges.some((e) => e.from === relFrom && e.to === spec);
      if (!alreadyTracked) {
        edges.push({ from: relFrom, to: spec, confidence: "high", type: "style" });
      }
    }
  }

  // API calls
  const apiPatterns = [
    /fetch\(\s*['"`]([^'"`]+)['"`]/g,
    /fetch\(\s*`([^`]*\$\{[^}]+\}[^`]*)`/g,
    /axios\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g,
    /api\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g,
  ];

  for (const pattern of apiPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const endpoint = match[2] || match[1];
      // Only track API-like paths
      if (endpoint.startsWith("/api/") || endpoint.startsWith("http")) {
        edges.push({ from: relFrom, to: endpoint, confidence: "medium", type: "api" });
      }
    }
  }

  // Config/env references
  const configPatterns = [
    /process\.env\.([A-Z][A-Z0-9_]+)/g,
    /import\s+.*from\s+['"].*config['"]/g,
  ];

  const envVars = new Set();
  for (const pattern of configPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        // process.env.VAR
        if (!envVars.has(match[1])) {
          envVars.add(match[1]);
          edges.push({ from: relFrom, to: `env:${match[1]}`, confidence: "medium", type: "config" });
        }
      } else {
        // config import
        edges.push({ from: relFrom, to: match[0], confidence: "medium", type: "config" });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function collectSourceFiles(root) {
  const files = [];

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (SOURCE_EXTS.has(extname(entry)) || STYLE_EXTS.has(extname(entry))) {
          files.push(full);
        }
      } catch { /* skip */ }
    }
  }

  for (const dir of SOURCE_DIRS) {
    const full = join(root, dir);
    if (existsSync(full)) walk(full);
  }

  // Also check root-level source files
  try {
    for (const entry of readdirSync(root)) {
      if (SOURCE_EXTS.has(extname(entry))) {
        files.push(join(root, entry));
      }
    }
  } catch { /* skip */ }

  return files;
}

// ---------------------------------------------------------------------------
// Import extraction
// ---------------------------------------------------------------------------

const IMPORT_PATTERNS = [
  /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /export\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
];

function extractImports(content) {
  const imports = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.add(match[1]);
    }
  }
  return imports;
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function loadPathAliases(root) {
  const aliases = {};
  const tsConfigPath = findTsConfig(root);
  if (!tsConfigPath) return aliases;

  const config = readJsonSafe(tsConfigPath);
  if (!config?.compilerOptions?.paths) return aliases;

  const baseUrl = config.compilerOptions.baseUrl || ".";
  const baseDir = resolve(dirname(tsConfigPath), baseUrl);

  for (const [alias, targets] of Object.entries(config.compilerOptions.paths)) {
    const prefix = alias.replace("/*", "/").replace("*", "");
    const target = targets[0]?.replace("/*", "/").replace("*", "") || "";
    aliases[prefix] = resolve(baseDir, target);
  }

  return aliases;
}

function findTsConfig(root) {
  for (const name of ["tsconfig.json", "tsconfig.app.json"]) {
    const p = join(root, name);
    if (existsSync(p)) return p;
  }
  const webConfig = join(root, "apps/web/tsconfig.json");
  if (existsSync(webConfig)) return webConfig;
  return null;
}

function resolveSpecifier(root, fromFile, specifier, compilerOptions) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/") && !specifier.startsWith("~/")) {
    return null;
  }

  const fromDir = dirname(fromFile);
  let resolved;

  if (specifier.startsWith(".")) {
    resolved = resolve(fromDir, specifier);
  } else {
    resolved = resolveAlias(root, specifier);
    if (!resolved) return null;
  }

  resolved = resolveWithExtensions(resolved);
  if (!resolved) return null;

  const rel = relative(root, resolved);
  if (rel.startsWith("..")) return null;
  return rel;
}

function resolveImportRegex(root, fromFile, specifier, aliases) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/") && !specifier.startsWith("~/")) {
    if (specifier.startsWith("@") && !specifier.startsWith("@types")) {
      const pkgDir = join(root, "packages", specifier.replace(/^@[^/]+\//, ""));
      if (existsSync(pkgDir)) {
        const indexFile = resolveWithExtensions(join(pkgDir, "src/index"));
        if (indexFile) return relative(root, indexFile);
      }
    }
    return null;
  }

  const fromDir = dirname(fromFile);
  let resolved;

  if (specifier.startsWith(".")) {
    resolved = resolve(fromDir, specifier);
  } else {
    for (const [prefix, target] of Object.entries(aliases)) {
      if (specifier.startsWith(prefix)) {
        resolved = join(target, specifier.slice(prefix.length));
        break;
      }
    }
    if (!resolved) return null;
  }

  resolved = resolveWithExtensions(resolved);
  if (!resolved) return null;

  const rel = relative(root, resolved);
  if (rel.startsWith("..")) return null;
  return rel;
}

function resolveAlias(root, specifier) {
  const aliases = loadPathAliases(root);
  for (const [prefix, target] of Object.entries(aliases)) {
    if (specifier.startsWith(prefix)) {
      return join(target, specifier.slice(prefix.length));
    }
  }
  return null;
}

function resolveWithExtensions(basePath) {
  if (existsSync(basePath) && !statSync(basePath).isDirectory()) return basePath;

  for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs"]) {
    const withExt = basePath + ext;
    if (existsSync(withExt)) return withExt;
  }

  for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs"]) {
    const indexFile = join(basePath, `index${ext}`);
    if (existsSync(indexFile)) return indexFile;
  }

  return null;
}
