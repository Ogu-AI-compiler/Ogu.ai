/**
 * Slice 137 — Permission Matrix + Access Control
 *
 * Permission Matrix: role-based permission definitions.
 * Access Control: enforce access decisions at runtime.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 137 — Permission Matrix + Access Control\x1b[0m\n");

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

// ── Part 2: Access Control ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Access Control\x1b[0m");

const acLib = join(process.cwd(), "tools/ogu/commands/lib/access-control.mjs");
assert("access-control.mjs exists", () => {
  if (!existsSync(acLib)) throw new Error("file missing");
});

const acMod = await import(acLib);

assert("createAccessControl returns controller", () => {
  if (typeof acMod.createAccessControl !== "function") throw new Error("missing");
  const ac = acMod.createAccessControl();
  if (typeof ac.enforce !== "function") throw new Error("missing enforce");
  if (typeof ac.addPolicy !== "function") throw new Error("missing addPolicy");
});

assert("enforce allows matching policy", () => {
  const ac = acMod.createAccessControl();
  ac.addPolicy({ role: "developer", resource: "src/*", action: "write", effect: "allow" });
  const result = ac.enforce({ role: "developer", resource: "src/app.ts", action: "write" });
  if (!result.allowed) throw new Error("should allow");
});

assert("enforce denies without matching policy", () => {
  const ac = acMod.createAccessControl();
  ac.addPolicy({ role: "developer", resource: "src/*", action: "write", effect: "allow" });
  const result = ac.enforce({ role: "developer", resource: "db/schema.sql", action: "write" });
  if (result.allowed) throw new Error("should deny - no matching policy");
});

assert("deny policies override allow", () => {
  const ac = acMod.createAccessControl();
  ac.addPolicy({ role: "dev", resource: "src/*", action: "write", effect: "allow" });
  ac.addPolicy({ role: "dev", resource: "src/config.ts", action: "write", effect: "deny" });
  const r1 = ac.enforce({ role: "dev", resource: "src/app.ts", action: "write" });
  if (!r1.allowed) throw new Error("src/app.ts should be allowed");
  const r2 = ac.enforce({ role: "dev", resource: "src/config.ts", action: "write" });
  if (r2.allowed) throw new Error("src/config.ts should be denied");
});

assert("getAuditLog tracks decisions", () => {
  const ac = acMod.createAccessControl();
  ac.addPolicy({ role: "qa", resource: "tests/*", action: "read", effect: "allow" });
  ac.enforce({ role: "qa", resource: "tests/a.ts", action: "read" });
  ac.enforce({ role: "qa", resource: "src/b.ts", action: "read" });
  const log = ac.getAuditLog();
  if (log.length !== 2) throw new Error(`expected 2 entries, got ${log.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
