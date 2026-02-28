/**
 * Slice 242 — Memory Mapped IO + IO Controller
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 242 — Memory Mapped IO + IO Controller\x1b[0m\n");
console.log("\x1b[36m  Part 1: Memory Mapped IO\x1b[0m");
const mmLib = join(process.cwd(), "tools/ogu/commands/lib/memory-mapped-io.mjs");
assert("memory-mapped-io.mjs exists", () => { if (!existsSync(mmLib)) throw new Error("missing"); });
const mmMod = await import(mmLib);
assert("map and read/write", () => {
  const mmio = mmMod.createMemoryMappedIO();
  mmio.mapRegion(0x1000, 256, "device1");
  mmio.write(0x1000, 42);
  if (mmio.read(0x1000)!==42) throw new Error("expected 42");
});
assert("unmapped read returns 0", () => {
  const mmio = mmMod.createMemoryMappedIO();
  if (mmio.read(0x9999)!==0) throw new Error("should be 0");
});
console.log("\n\x1b[36m  Part 2: IO Controller\x1b[0m");
const ioLib = join(process.cwd(), "tools/ogu/commands/lib/io-controller.mjs");
assert("io-controller.mjs exists", () => { if (!existsSync(ioLib)) throw new Error("missing"); });
const ioMod = await import(ioLib);
assert("register and send command", () => {
  const io = ioMod.createIOController();
  let received = null;
  io.registerDevice("disk", { execute: (cmd) => { received = cmd; return "ok"; } });
  const result = io.send("disk", "read");
  if (result!=="ok"||received!=="read") throw new Error("wrong");
});
assert("listDevices returns all", () => {
  const io = ioMod.createIOController();
  io.registerDevice("a", { execute:()=>{} });
  io.registerDevice("b", { execute:()=>{} });
  if (io.listDevices().length!==2) throw new Error("expected 2");
});
console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
