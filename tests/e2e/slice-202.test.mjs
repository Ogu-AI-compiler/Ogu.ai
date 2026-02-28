/**
 * Slice 202 — DNS Resolver Mock + Host Registry
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 202 — DNS Resolver Mock + Host Registry\x1b[0m\n");

console.log("\x1b[36m  Part 1: DNS Resolver Mock\x1b[0m");
const drLib = join(process.cwd(), "tools/ogu/commands/lib/dns-resolver.mjs");
assert("dns-resolver.mjs exists", () => { if (!existsSync(drLib)) throw new Error("missing"); });
const drMod = await import(drLib);
assert("resolve returns IP for registered domain", () => {
  const dns = drMod.createDnsResolver();
  dns.addRecord("example.com", "93.184.216.34");
  const ip = dns.resolve("example.com");
  if (ip !== "93.184.216.34") throw new Error(`expected IP, got ${ip}`);
});
assert("returns null for unknown domain", () => {
  const dns = drMod.createDnsResolver();
  if (dns.resolve("unknown.com") !== null) throw new Error("should be null");
});
assert("supports multiple records", () => {
  const dns = drMod.createDnsResolver();
  dns.addRecord("api.test", "10.0.0.1");
  dns.addRecord("web.test", "10.0.0.2");
  if (dns.resolve("api.test") !== "10.0.0.1") throw new Error("wrong ip");
  if (dns.resolve("web.test") !== "10.0.0.2") throw new Error("wrong ip");
});

console.log("\n\x1b[36m  Part 2: Host Registry\x1b[0m");
const hrLib = join(process.cwd(), "tools/ogu/commands/lib/host-registry.mjs");
assert("host-registry.mjs exists", () => { if (!existsSync(hrLib)) throw new Error("missing"); });
const hrMod = await import(hrLib);
assert("register and lookup host", () => {
  const reg = hrMod.createHostRegistry();
  reg.register("web-1", { ip: "10.0.0.1", port: 8080 });
  const host = reg.lookup("web-1");
  if (host.ip !== "10.0.0.1") throw new Error("wrong ip");
});
assert("deregister removes host", () => {
  const reg = hrMod.createHostRegistry();
  reg.register("h1", { ip: "1.1.1.1" });
  reg.deregister("h1");
  if (reg.lookup("h1") !== null) throw new Error("should be null");
});
assert("listHosts returns all", () => {
  const reg = hrMod.createHostRegistry();
  reg.register("a", {}); reg.register("b", {}); reg.register("c", {});
  if (reg.listHosts().length !== 3) throw new Error("expected 3");
});
assert("getStats returns count", () => {
  const reg = hrMod.createHostRegistry();
  reg.register("x", {});
  const s = reg.getStats();
  if (s.total !== 1) throw new Error("expected 1");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
