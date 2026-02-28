/**
 * Slice 240 — Stack Machine + Register Machine
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 240 — Stack Machine + Register Machine\x1b[0m\n");
console.log("\x1b[36m  Part 1: Stack Machine\x1b[0m");
const smLib = join(process.cwd(), "tools/ogu/commands/lib/stack-machine.mjs");
assert("stack-machine.mjs exists", () => { if (!existsSync(smLib)) throw new Error("missing"); });
const smMod = await import(smLib);
assert("push and add", () => {
  const sm = smMod.createStackMachine();
  sm.execute([{op:"PUSH",val:3},{op:"PUSH",val:4},{op:"ADD"}]);
  if (sm.peek()!==7) throw new Error(`expected 7, got ${sm.peek()}`);
});
assert("multiply works", () => {
  const sm = smMod.createStackMachine();
  sm.execute([{op:"PUSH",val:5},{op:"PUSH",val:6},{op:"MUL"}]);
  if (sm.peek()!==30) throw new Error("expected 30");
});
console.log("\n\x1b[36m  Part 2: Register Machine\x1b[0m");
const rmLib = join(process.cwd(), "tools/ogu/commands/lib/register-machine.mjs");
assert("register-machine.mjs exists", () => { if (!existsSync(rmLib)) throw new Error("missing"); });
const rmMod = await import(rmLib);
assert("LOAD and ADD", () => {
  const rm = rmMod.createRegisterMachine();
  rm.execute([{op:"LOAD",reg:"R0",val:10},{op:"LOAD",reg:"R1",val:20},{op:"ADD",dst:"R2",src1:"R0",src2:"R1"}]);
  if (rm.getRegister("R2")!==30) throw new Error("expected 30");
});
assert("getRegisters returns all", () => {
  const rm = rmMod.createRegisterMachine();
  rm.execute([{op:"LOAD",reg:"A",val:1}]);
  const regs = rm.getRegisters();
  if (regs.A!==1) throw new Error("expected A=1");
});
console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
