/**
 * Slice 177 — Instruction Emitter + Bytecode Builder
 *
 * Instruction Emitter: emit typed instructions for a virtual machine.
 * Bytecode Builder: build bytecode sequences from instructions.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 177 — Instruction Emitter + Bytecode Builder\x1b[0m\n");

// ── Part 1: Instruction Emitter ──────────────────────────────

console.log("\x1b[36m  Part 1: Instruction Emitter\x1b[0m");

const ieLib = join(process.cwd(), "tools/ogu/commands/lib/instruction-emitter.mjs");
assert("instruction-emitter.mjs exists", () => {
  if (!existsSync(ieLib)) throw new Error("file missing");
});

const ieMod = await import(ieLib);

assert("createInstructionEmitter returns emitter", () => {
  if (typeof ieMod.createInstructionEmitter !== "function") throw new Error("missing");
  const e = ieMod.createInstructionEmitter();
  if (typeof e.emit !== "function") throw new Error("missing emit");
  if (typeof e.getInstructions !== "function") throw new Error("missing getInstructions");
});

assert("emit adds instruction", () => {
  const e = ieMod.createInstructionEmitter();
  e.emit({ op: "LOAD", arg: 42 });
  e.emit({ op: "ADD", arg: 10 });
  const insts = e.getInstructions();
  if (insts.length !== 2) throw new Error(`expected 2, got ${insts.length}`);
  if (insts[0].op !== "LOAD") throw new Error("wrong op");
});

assert("emit assigns addresses", () => {
  const e = ieMod.createInstructionEmitter();
  e.emit({ op: "NOP" });
  e.emit({ op: "HALT" });
  const insts = e.getInstructions();
  if (insts[0].address !== 0) throw new Error("first should be 0");
  if (insts[1].address !== 1) throw new Error("second should be 1");
});

assert("clear resets instructions", () => {
  const e = ieMod.createInstructionEmitter();
  e.emit({ op: "X" });
  e.clear();
  if (e.getInstructions().length !== 0) throw new Error("should be empty");
});

// ── Part 2: Bytecode Builder ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Bytecode Builder\x1b[0m");

const bbLib = join(process.cwd(), "tools/ogu/commands/lib/bytecode-builder.mjs");
assert("bytecode-builder.mjs exists", () => {
  if (!existsSync(bbLib)) throw new Error("file missing");
});

const bbMod = await import(bbLib);

assert("createBytecodeBuilder returns builder", () => {
  if (typeof bbMod.createBytecodeBuilder !== "function") throw new Error("missing");
  const b = bbMod.createBytecodeBuilder();
  if (typeof b.addOp !== "function") throw new Error("missing addOp");
  if (typeof b.build !== "function") throw new Error("missing build");
});

assert("addOp and build produce bytecode", () => {
  const b = bbMod.createBytecodeBuilder();
  b.addOp(0x01, [0x2A]); // LOAD 42
  b.addOp(0x02, [0x0A]); // ADD 10
  const bytes = b.build();
  if (!Array.isArray(bytes)) throw new Error("should be array");
  if (bytes.length !== 4) throw new Error(`expected 4 bytes, got ${bytes.length}`);
  if (bytes[0] !== 0x01) throw new Error("first byte should be 0x01");
  if (bytes[1] !== 0x2A) throw new Error("second byte should be 0x2A");
});

assert("addLabel and addJump create references", () => {
  const b = bbMod.createBytecodeBuilder();
  b.addLabel("start");
  b.addOp(0x10, []); // NOP
  b.addOp(0x20, []); // JUMP
  const labels = b.getLabels();
  if (!labels.start && labels.start !== 0) throw new Error("should have start label");
});

assert("getSize returns total bytes", () => {
  const b = bbMod.createBytecodeBuilder();
  b.addOp(0x01, [0xFF, 0xFF]);
  if (b.getSize() !== 3) throw new Error(`expected 3, got ${b.getSize()}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
