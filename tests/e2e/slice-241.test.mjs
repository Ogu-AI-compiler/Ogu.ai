/**
 * Slice 241 — Instruction Decoder + Opcode Table
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 241 — Instruction Decoder + Opcode Table\x1b[0m\n");
console.log("\x1b[36m  Part 1: Instruction Decoder\x1b[0m");
const idLib = join(process.cwd(), "tools/ogu/commands/lib/instruction-decoder.mjs");
assert("instruction-decoder.mjs exists", () => { if (!existsSync(idLib)) throw new Error("missing"); });
const idMod = await import(idLib);
assert("decode parses instruction", () => {
  const d = idMod.createInstructionDecoder();
  d.addFormat("ADD", ["dst","src1","src2"]);
  const result = d.decode({ opcode: "ADD", operands: ["R0","R1","R2"] });
  if (result.op!=="ADD"||result.dst!=="R0") throw new Error("wrong decode");
});
assert("unknown opcode returns null", () => {
  const d = idMod.createInstructionDecoder();
  if (d.decode({ opcode: "XYZ", operands: [] })!==null) throw new Error("should be null");
});
console.log("\n\x1b[36m  Part 2: Opcode Table\x1b[0m");
const otLib = join(process.cwd(), "tools/ogu/commands/lib/opcode-table.mjs");
assert("opcode-table.mjs exists", () => { if (!existsSync(otLib)) throw new Error("missing"); });
const otMod = await import(otLib);
assert("register and lookup opcodes", () => {
  const ot = otMod.createOpcodeTable();
  ot.register(0x01, "ADD", { operands: 3 });
  const info = ot.lookup(0x01);
  if (info.mnemonic!=="ADD") throw new Error("wrong mnemonic");
});
assert("lookupByName works", () => {
  const ot = otMod.createOpcodeTable();
  ot.register(0x02, "SUB", {});
  if (ot.lookupByName("SUB").code!==0x02) throw new Error("wrong code");
});
console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
