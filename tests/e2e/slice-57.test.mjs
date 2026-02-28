/**
 * Slice 57 — Config Schema Validator + Migration Engine
 *
 * Schema validator: validate JSON configs against declarative schemas.
 * Migration engine: version-aware config migration with transforms.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice57-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 57 — Config Schema Validator + Migration Engine\x1b[0m\n");
console.log("  Declarative schema validation, version-aware migrations\n");

// ── Part 1: Config Schema Validator ──────────────────────────────

console.log("\x1b[36m  Part 1: Config Schema Validator\x1b[0m");

const schemaLib = join(process.cwd(), "tools/ogu/commands/lib/config-schema.mjs");
assert("config-schema.mjs exists", () => {
  if (!existsSync(schemaLib)) throw new Error("file missing");
});

const schemaMod = await import(schemaLib);

assert("validateConfig validates against schema", () => {
  if (typeof schemaMod.validateConfig !== "function") throw new Error("missing");
  const schema = {
    type: "object",
    required: ["name", "version"],
    properties: {
      name: { type: "string" },
      version: { type: "string" },
      count: { type: "number" },
    },
  };
  const result = schemaMod.validateConfig({ name: "test", version: "1.0" }, schema);
  if (!result.valid) throw new Error("should be valid");
  if (!Array.isArray(result.errors)) throw new Error("should have errors array");
});

assert("validateConfig reports missing required fields", () => {
  const schema = {
    type: "object",
    required: ["name", "version"],
    properties: {
      name: { type: "string" },
      version: { type: "string" },
    },
  };
  const result = schemaMod.validateConfig({ name: "test" }, schema);
  if (result.valid) throw new Error("should be invalid");
  if (result.errors.length < 1) throw new Error("should have errors");
  if (!result.errors[0].includes("version")) throw new Error("should mention missing field");
});

assert("validateConfig checks type mismatches", () => {
  const schema = {
    type: "object",
    required: [],
    properties: {
      count: { type: "number" },
      active: { type: "boolean" },
    },
  };
  const result = schemaMod.validateConfig({ count: "not-a-number", active: "yes" }, schema);
  if (result.valid) throw new Error("should detect type mismatch");
  if (result.errors.length < 2) throw new Error("should have 2 type errors");
});

assert("validateConfig validates arrays", () => {
  const schema = {
    type: "object",
    required: ["tags"],
    properties: {
      tags: { type: "array" },
    },
  };
  const valid = schemaMod.validateConfig({ tags: ["a", "b"] }, schema);
  if (!valid.valid) throw new Error("array should be valid");
  const invalid = schemaMod.validateConfig({ tags: "not-array" }, schema);
  if (invalid.valid) throw new Error("string should not pass array check");
});

assert("OGU_SCHEMAS provides built-in schemas", () => {
  if (!schemaMod.OGU_SCHEMAS) throw new Error("missing");
  if (!schemaMod.OGU_SCHEMAS.STATE) throw new Error("missing STATE schema");
  if (!schemaMod.OGU_SCHEMAS.ORGSPEC) throw new Error("missing ORGSPEC schema");
});

// ── Part 2: Migration Engine ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Migration Engine\x1b[0m");

const migrateLib = join(process.cwd(), "tools/ogu/commands/lib/config-migrate.mjs");
assert("config-migrate.mjs exists", () => {
  if (!existsSync(migrateLib)) throw new Error("file missing");
});

const migrateMod = await import(migrateLib);

assert("createMigrationEngine returns engine", () => {
  if (typeof migrateMod.createMigrationEngine !== "function") throw new Error("missing");
  const engine = migrateMod.createMigrationEngine();
  if (typeof engine.register !== "function") throw new Error("missing register");
  if (typeof engine.migrate !== "function") throw new Error("missing migrate");
  if (typeof engine.getVersion !== "function") throw new Error("missing getVersion");
});

assert("register adds migration steps", () => {
  const engine = migrateMod.createMigrationEngine();
  engine.register("1.0", "2.0", (config) => ({ ...config, newField: true }));
  engine.register("2.0", "3.0", (config) => ({ ...config, upgraded: true }));
  const versions = engine.getVersions();
  if (versions.length < 2) throw new Error("should have 2 migrations");
});

assert("migrate applies transformations in order", () => {
  const engine = migrateMod.createMigrationEngine();
  engine.register("1.0", "2.0", (config) => ({ ...config, v2: true }));
  engine.register("2.0", "3.0", (config) => ({ ...config, v3: true }));
  const result = engine.migrate({ name: "test", _version: "1.0" }, "3.0");
  if (!result.v2) throw new Error("should have v2 field");
  if (!result.v3) throw new Error("should have v3 field");
  if (result._version !== "3.0") throw new Error("version should be 3.0");
});

assert("migrate handles no-op when already at target", () => {
  const engine = migrateMod.createMigrationEngine();
  engine.register("1.0", "2.0", (config) => ({ ...config, v2: true }));
  const result = engine.migrate({ name: "test", _version: "2.0" }, "2.0");
  if (result.v2) throw new Error("should not apply migration");
});

assert("getVersion extracts version from config", () => {
  const engine = migrateMod.createMigrationEngine();
  if (engine.getVersion({ _version: "1.5" }) !== "1.5") throw new Error("wrong version");
  if (engine.getVersion({}) !== "0.0") throw new Error("should default to 0.0");
});

assert("migrate returns migration log", () => {
  const engine = migrateMod.createMigrationEngine();
  engine.register("1.0", "2.0", (config) => ({ ...config, v2: true }));
  engine.register("2.0", "3.0", (config) => ({ ...config, v3: true }));
  const result = engine.migrate({ _version: "1.0" }, "3.0");
  // result._migrations should log applied migrations
  if (!Array.isArray(result._migrations)) throw new Error("should have _migrations log");
  if (result._migrations.length !== 2) throw new Error(`expected 2 migrations, got ${result._migrations.length}`);
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
