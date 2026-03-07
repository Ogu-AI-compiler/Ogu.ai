/**
 * Slice 137 — Permission Matrix
 *
 * Permission Matrix: role-based permission definitions.

 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 137 — Permission Matrix\x1b[0m\n");

// ── Part 1: Permission Matrix ──────────────────────────────

console.log("\x1b[36m  Part 1: Permission Matrix\x1b[0m");

const pmLib = join(process.cwd(), "tools/ogu/commands/lib/permission-matrix.mjs");
assert("permission-matrix.mjs exists", () => {
  if (!existsSync(pmLib)) throw new Error("file missing");
});

const pmMod = await import(pmLib);

assert("createPermissionMatrix returns matrix", () => {
  if (typeof pmMod.createPermissionMatrix !== "function") throw new Error("missing");
  const matrix = pmMod.createPermissionMatrix();
  if (typeof matrix.grant !== "function") throw new Error("missing grant");
  if (typeof matrix.check !== "function") throw new Error("missing check");
  if (typeof matrix.listPermissions !== "function") throw new Error("missing listPermissions");
});

assert("grant and check permissions", () => {
  const matrix = pmMod.createPermissionMatrix();
  matrix.grant("developer", "code.write");
  matrix.grant("developer", "code.read");
  matrix.grant("developer", "test.run");
  if (!matrix.check("developer", "code.write")) throw new Error("should have code.write");
  if (!matrix.check("developer", "code.read")) throw new Error("should have code.read");
  if (matrix.check("developer", "deploy.prod")) throw new Error("should not have deploy.prod");
});

assert("revoke removes permission", () => {
  const matrix = pmMod.createPermissionMatrix();
  matrix.grant("qa", "test.run");
  matrix.grant("qa", "test.write");
  matrix.revoke("qa", "test.write");
  if (!matrix.check("qa", "test.run")) throw new Error("should still have test.run");
  if (matrix.check("qa", "test.write")) throw new Error("should not have test.write");
});

assert("listPermissions returns role permissions", () => {
  const matrix = pmMod.createPermissionMatrix();
  matrix.grant("admin", "deploy.prod");
  matrix.grant("admin", "code.write");
  const perms = matrix.listPermissions("admin");
  if (perms.length !== 2) throw new Error(`expected 2, got ${perms.length}`);
});

assert("wildcard permission grants all", () => {
  const matrix = pmMod.createPermissionMatrix();
  matrix.grant("cto", "*");
  if (!matrix.check("cto", "anything.at.all")) throw new Error("wildcard should match all");
});
