/**
 * Slice 66 — Permission Matrix + Access Control List
 *
 * Permission matrix: role×action matrix with inheritance.
 * ACL: resource-based access control with deny-overrides.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice66-${Date.now()}`);
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

console.log("\n\x1b[1mSlice 66 — Permission Matrix + Access Control List\x1b[0m\n");

// ── Part 1: Permission Matrix ──────────────────────────────

console.log("\x1b[36m  Part 1: Permission Matrix\x1b[0m");

const permLib = join(process.cwd(), "tools/ogu/commands/lib/permission-matrix.mjs");
assert("permission-matrix.mjs exists", () => {
  if (!existsSync(permLib)) throw new Error("file missing");
});

const permMod = await import(permLib);

assert("createMatrix returns matrix", () => {
  if (typeof permMod.createMatrix !== "function") throw new Error("missing");
  const m = permMod.createMatrix();
  if (typeof m.grant !== "function") throw new Error("missing grant");
  if (typeof m.check !== "function") throw new Error("missing check");
  if (typeof m.revoke !== "function") throw new Error("missing revoke");
});

assert("grant and check work together", () => {
  const m = permMod.createMatrix();
  m.grant("developer", "code.write");
  m.grant("developer", "code.read");
  if (!m.check("developer", "code.write")) throw new Error("should be permitted");
  if (!m.check("developer", "code.read")) throw new Error("should be permitted");
  if (m.check("developer", "deploy")) throw new Error("should NOT be permitted");
});

assert("revoke removes permission", () => {
  const m = permMod.createMatrix();
  m.grant("tester", "test.run");
  m.revoke("tester", "test.run");
  if (m.check("tester", "test.run")) throw new Error("should be revoked");
});

assert("inherit copies permissions from parent role", () => {
  if (typeof permMod.createMatrix({}).inherit !== "function") throw new Error("missing inherit");
  const m = permMod.createMatrix();
  m.grant("developer", "code.write");
  m.grant("developer", "code.read");
  m.inherit("senior-dev", "developer");
  if (!m.check("senior-dev", "code.write")) throw new Error("should inherit code.write");
});

assert("getPermissions lists role permissions", () => {
  const m = permMod.createMatrix();
  m.grant("admin", "everything");
  m.grant("admin", "deploy");
  const perms = m.getPermissions("admin");
  if (!Array.isArray(perms)) throw new Error("should return array");
  if (perms.length !== 2) throw new Error(`expected 2, got ${perms.length}`);
});

// ── Part 2: Access Control List ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Access Control List\x1b[0m");

const aclLib = join(process.cwd(), "tools/ogu/commands/lib/acl.mjs");
assert("acl.mjs exists", () => {
  if (!existsSync(aclLib)) throw new Error("file missing");
});

const aclMod = await import(aclLib);

assert("createACL returns acl", () => {
  if (typeof aclMod.createACL !== "function") throw new Error("missing");
  const acl = aclMod.createACL();
  if (typeof acl.allow !== "function") throw new Error("missing allow");
  if (typeof acl.deny !== "function") throw new Error("missing deny");
  if (typeof acl.isAllowed !== "function") throw new Error("missing isAllowed");
});

assert("allow grants resource access", () => {
  const acl = aclMod.createACL();
  acl.allow("developer", "src/*", "read");
  if (!acl.isAllowed("developer", "src/index.ts", "read")) throw new Error("should be allowed");
});

assert("deny overrides allow", () => {
  const acl = aclMod.createACL();
  acl.allow("developer", "src/*", "write");
  acl.deny("developer", "src/config.secret.ts", "write");
  if (!acl.isAllowed("developer", "src/index.ts", "write")) throw new Error("should be allowed");
  if (acl.isAllowed("developer", "src/config.secret.ts", "write")) throw new Error("deny should override");
});

assert("isAllowed returns false by default", () => {
  const acl = aclMod.createACL();
  if (acl.isAllowed("unknown", "any/file", "read")) throw new Error("should default deny");
});

assert("listRules returns all ACL rules", () => {
  const acl = aclMod.createACL();
  acl.allow("dev", "src/*", "read");
  acl.deny("dev", ".env", "read");
  if (typeof acl.listRules !== "function") throw new Error("missing listRules");
  const rules = acl.listRules();
  if (rules.length !== 2) throw new Error(`expected 2 rules, got ${rules.length}`);
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
