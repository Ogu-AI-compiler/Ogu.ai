/**
 * Slice 95 — Output Sanitizer + Input Validator
 *
 * Output sanitizer: clean sensitive data from outputs.
 * Input validator: validate and sanitize user/agent inputs.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 95 — Output Sanitizer + Input Validator\x1b[0m\n");

// ── Part 1: Output Sanitizer ──────────────────────────────

console.log("\x1b[36m  Part 1: Output Sanitizer\x1b[0m");

const osLib = join(process.cwd(), "tools/ogu/commands/lib/output-sanitizer.mjs");
assert("output-sanitizer.mjs exists", () => {
  if (!existsSync(osLib)) throw new Error("file missing");
});

const osMod = await import(osLib);

assert("sanitize removes API keys", () => {
  if (typeof osMod.sanitize !== "function") throw new Error("missing");
  const output = "Connected with key sk-1234567890abcdef";
  const clean = osMod.sanitize(output);
  if (clean.includes("sk-1234567890abcdef")) throw new Error("should redact API key");
  if (!clean.includes("[REDACTED]")) throw new Error("should show redacted marker");
});

assert("sanitize removes tokens", () => {
  const output = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig";
  const clean = osMod.sanitize(output);
  if (clean.includes("eyJhbGci")) throw new Error("should redact JWT");
});

assert("sanitize preserves non-sensitive text", () => {
  const output = "Build completed successfully in 12s";
  const clean = osMod.sanitize(output);
  if (clean !== output) throw new Error("should not modify clean text");
});

assert("sanitizeObject redacts keys in objects", () => {
  if (typeof osMod.sanitizeObject !== "function") throw new Error("missing");
  const obj = { name: "test", apiKey: "secret123", password: "pass" };
  const clean = osMod.sanitizeObject(obj);
  if (clean.apiKey !== "[REDACTED]") throw new Error("should redact apiKey");
  if (clean.password !== "[REDACTED]") throw new Error("should redact password");
  if (clean.name !== "test") throw new Error("should preserve name");
});

// ── Part 2: Input Validator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Input Validator\x1b[0m");

const ivLib = join(process.cwd(), "tools/ogu/commands/lib/input-validator.mjs");
assert("input-validator.mjs exists", () => {
  if (!existsSync(ivLib)) throw new Error("file missing");
});

const ivMod = await import(ivLib);

assert("validateInput checks required fields", () => {
  if (typeof ivMod.validateInput !== "function") throw new Error("missing");
  const schema = { fields: { name: { required: true, type: "string" } } };
  const result = ivMod.validateInput({}, schema);
  if (result.valid) throw new Error("missing required field should fail");
  if (result.errors.length === 0) throw new Error("should have errors");
});

assert("validateInput passes valid input", () => {
  const schema = {
    fields: {
      name: { required: true, type: "string" },
      age: { required: false, type: "number" },
    },
  };
  const result = ivMod.validateInput({ name: "Test", age: 25 }, schema);
  if (!result.valid) throw new Error(`should pass: ${result.errors.join(", ")}`);
});

assert("validateInput checks type", () => {
  const schema = { fields: { count: { required: true, type: "number" } } };
  const result = ivMod.validateInput({ count: "not a number" }, schema);
  if (result.valid) throw new Error("wrong type should fail");
});

assert("sanitizeInput strips unknown fields", () => {
  if (typeof ivMod.sanitizeInput !== "function") throw new Error("missing");
  const schema = { fields: { name: { required: true, type: "string" } } };
  const clean = ivMod.sanitizeInput({ name: "Test", evil: "<script>" }, schema);
  if (clean.evil) throw new Error("should strip unknown fields");
  if (clean.name !== "Test") throw new Error("should preserve known fields");
});

assert("VALIDATION_TYPES exported", () => {
  if (!ivMod.VALIDATION_TYPES) throw new Error("missing");
  if (!Array.isArray(ivMod.VALIDATION_TYPES)) throw new Error("should be array");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
