// Per-TYPE drift verification strategies.
// Each verifier returns { status: "present" | "missing" | "changed", evidence: string }

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { normalizeIR } from "./normalize-ir.mjs";

const SOURCE_EXTS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const IGNORE_DIRS = new Set(["node_modules", ".git", ".ogu", "dist", "build", ".next", "coverage"]);

/**
 * Verify a single IR output exists in the codebase.
 */
export function verifyOutput(root, identifier) {
  const normalized = normalizeIR(identifier);
  const [type, ...rest] = normalized.split(":");
  const id = rest.join(":");

  const verifier = VERIFIERS[type];
  if (!verifier) {
    // Fallback: treat identifier as file path
    return verifyFile(root, id);
  }
  return verifier(root, id);
}

const VERIFIERS = {
  API: verifyAPI,
  ROUTE: verifyRoute,
  COMPONENT: verifyComponent,
  SCHEMA: verifySchema,
  CONTRACT: verifyContract,
  TOKEN: verifyToken,
  FILE: verifyFile,
  TEST: verifyTest,
};

function verifyAPI(root, id) {
  // id format: "/users GET" or "/users/:id POST"
  const parts = id.split(" ");
  const path = parts[0];
  const method = (parts[1] || "GET").toLowerCase();

  // Search for route registration patterns
  const patterns = [
    // Express: router.get("/users", ...)
    new RegExp(`\\.(${method})\\s*\\(\\s*["'\`]${escapeRegex(path)}["'\`]`),
    // Fastify: fastify.get("/users", ...)
    new RegExp(`\\.(${method})\\s*\\(\\s*["'\`]${escapeRegex(path)}["'\`]`),
  ];

  // Check Next.js App Router: app/api/**/route.ts
  const routePath = path.replace(/^\//, "").replace(/\/:[^/]+/g, "/[id]");
  const nextApiPath = join(root, "app/api", routePath, "route.ts");
  const nextApiPathAlt = join(root, "src/app/api", routePath, "route.ts");

  for (const p of [nextApiPath, nextApiPathAlt]) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf-8");
      if (content.includes(`export`) && content.toUpperCase().includes(method.toUpperCase())) {
        return { status: "present", evidence: `${p} — export ${method.toUpperCase()} handler` };
      }
    }
  }

  // Grep source files for route handler
  const result = grepSource(root, patterns);
  if (result) {
    return { status: "present", evidence: result };
  }

  return { status: "missing", evidence: `No route handler found for ${method.toUpperCase()} ${path}` };
}

function verifyRoute(root, id) {
  // id format: "/users" or "/users/:id"
  const routePath = id.replace(/^\//, "").replace(/\/:[^/]+/g, "/[id]");

  // Check Next.js App Router: app/**/page.tsx
  for (const base of ["app", "src/app"]) {
    const pagePath = join(root, base, routePath, "page.tsx");
    const pagePathJsx = join(root, base, routePath, "page.jsx");
    for (const p of [pagePath, pagePathJsx]) {
      if (existsSync(p)) {
        return { status: "present", evidence: `${p}` };
      }
    }
  }

  // Grep for route registration
  const patterns = [
    new RegExp(`["'\`]${escapeRegex(id)}["'\`]`),
    new RegExp(`path\\s*:\\s*["'\`]${escapeRegex(id)}["'\`]`),
  ];
  const result = grepSource(root, patterns);
  if (result) {
    return { status: "present", evidence: result };
  }

  return { status: "missing", evidence: `No page or route registration found for ${id}` };
}

function verifyComponent(root, id) {
  // id format: "UserCard" — check file exists AND has a named export
  const patterns = [
    `${id}.tsx`, `${id}.jsx`, `${id}.ts`, `${id}.js`,
    `${id}/index.tsx`, `${id}/index.jsx`,
  ];

  for (const dir of ["src", "apps", "packages", "lib", "app", "components"]) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;

    const found = findFileRecursive(fullDir, patterns);
    if (found) {
      const content = readFileSync(found, "utf-8");
      const exportPatterns = [
        new RegExp(`export\\s+(?:default\\s+)?function\\s+${escapeRegex(id)}`),
        new RegExp(`export\\s+const\\s+${escapeRegex(id)}`),
        new RegExp(`export\\s+default\\s+${escapeRegex(id)}`),
        /export\s+default\s+function/,
      ];
      for (const pat of exportPatterns) {
        if (pat.test(content)) {
          return { status: "present", evidence: `${found} — export found` };
        }
      }
      return { status: "changed", evidence: `${found} exists but no matching export for ${id}` };
    }
  }

  return { status: "missing", evidence: `Component file not found: ${id}` };
}

function verifySchema(root, id) {
  // id format: "users-table" or "User" (Prisma model)
  const prismaPath = join(root, "prisma/schema.prisma");
  if (existsSync(prismaPath)) {
    const content = readFileSync(prismaPath, "utf-8");
    const pattern = new RegExp(`^model\\s+${escapeRegex(id)}\\b`, "m");
    if (pattern.test(content)) {
      const line = content.split("\n").findIndex((l) => pattern.test(l)) + 1;
      return { status: "present", evidence: `prisma/schema.prisma:${line}` };
    }
  }

  // Check SQL migrations
  const migrationsDir = join(root, "prisma/migrations");
  if (existsSync(migrationsDir)) {
    const tableName = id.replace(/-/g, "_").toLowerCase();
    const pattern = new RegExp(`CREATE\\s+TABLE.*${escapeRegex(tableName)}`, "i");
    const result = grepDir(migrationsDir, pattern);
    if (result) {
      return { status: "present", evidence: result };
    }
  }

  return { status: "missing", evidence: `Schema/model not found: ${id}` };
}

function verifyContract(root, id) {
  // id format: "api" → check docs/vault/02_Contracts/api.contract.json
  const contractPath = join(root, `docs/vault/02_Contracts/${id}.contract.json`);
  if (existsSync(contractPath)) {
    try {
      const contract = JSON.parse(readFileSync(contractPath, "utf-8"));
      return { status: "present", evidence: `${contractPath} — v${contract.version || "?"}` };
    } catch {
      return { status: "changed", evidence: `${contractPath} exists but invalid JSON` };
    }
  }
  return { status: "missing", evidence: `Contract file not found: ${id}.contract.json` };
}

function verifyToken(root, id) {
  // id format: "colors.primary" → check design.tokens.json
  const tokensPath = join(root, "design.tokens.json");
  if (!existsSync(tokensPath)) {
    return { status: "missing", evidence: "design.tokens.json not found" };
  }

  try {
    const tokens = JSON.parse(readFileSync(tokensPath, "utf-8"));
    const parts = id.split(".");
    let current = tokens;
    for (const part of parts) {
      if (!current || typeof current !== "object" || !(part in current)) {
        return { status: "missing", evidence: `Token path ${id} not found in design.tokens.json` };
      }
      current = current[part];
    }
    return { status: "present", evidence: `design.tokens.json — ${id} = ${JSON.stringify(current)}` };
  } catch {
    return { status: "changed", evidence: "design.tokens.json is invalid JSON" };
  }
}

function verifyFile(root, id) {
  const fullPath = join(root, id);
  if (existsSync(fullPath)) {
    return { status: "present", evidence: id };
  }
  return { status: "missing", evidence: `File not found: ${id}` };
}

function verifyTest(root, id) {
  // id format: "user-api" → find test file and verify it has test cases
  const candidates = [
    `tests/${id}.test.ts`, `tests/${id}.test.js`,
    `tests/${id}.spec.ts`, `tests/${id}.spec.js`,
    `__tests__/${id}.test.ts`, `__tests__/${id}.test.js`,
    `tests/e2e/${id}.test.ts`, `tests/e2e/${id}.spec.ts`,
    `tests/smoke/${id}.test.ts`, `tests/smoke/${id}.spec.ts`,
  ];

  for (const candidate of candidates) {
    const fullPath = join(root, candidate);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, "utf-8");
      const testCount = (content.match(/\b(?:it|test|describe)\s*\(/g) || []).length;
      if (testCount > 0) {
        return { status: "present", evidence: `${candidate} — ${testCount} test case(s)` };
      }
      return { status: "changed", evidence: `${candidate} exists but has no test cases` };
    }
  }

  return { status: "missing", evidence: `Test file not found: ${id}` };
}

// --- Helpers ---

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function grepSource(root, patterns) {
  const sourceDirs = ["src", "apps", "packages", "lib", "app"];
  for (const dir of sourceDirs) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    const result = grepDirForPatterns(fullDir, root, patterns);
    if (result) return result;
  }
  return null;
}

function grepDirForPatterns(dir, root, patterns) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const result = grepDirForPatterns(fullPath, root, patterns);
        if (result) return result;
      } else if (SOURCE_EXTS.test(entry.name)) {
        const content = readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          for (const pattern of patterns) {
            if (pattern.test(lines[i])) {
              const relPath = fullPath.slice(root.length + 1);
              return `${relPath}:${i + 1}`;
            }
          }
        }
      }
    }
  } catch { /* skip */ }
  return null;
}

function grepDir(dir, pattern) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const result = grepDir(fullPath, pattern);
        if (result) return result;
      } else {
        const content = readFileSync(fullPath, "utf-8");
        if (pattern.test(content)) {
          const line = content.split("\n").findIndex((l) => pattern.test(l)) + 1;
          return `${fullPath}:${line}`;
        }
      }
    }
  } catch { /* skip */ }
  return null;
}

function findFileRecursive(dir, fileNames) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Check compound names like UserCard/index.tsx
        for (const fn of fileNames) {
          if (fn.includes("/") && fn.startsWith(entry.name + "/")) {
            const subFile = fn.slice(entry.name.length + 1);
            const subPath = join(fullPath, subFile);
            if (existsSync(subPath)) return subPath;
          }
        }
        const result = findFileRecursive(fullPath, fileNames);
        if (result) return result;
      } else {
        for (const fn of fileNames) {
          if (!fn.includes("/") && entry.name === fn) return fullPath;
        }
      }
    }
  } catch { /* skip */ }
  return null;
}
