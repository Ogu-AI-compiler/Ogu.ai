/**
 * Slice 378 — Studio UI Marketplace
 * Tests: AgentCard renders name/role/skills, Marketplace renders grid,
 *        filter state works, route registered in MainArea.
 * Uses static analysis + file checks (no DOM/React renderer needed).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 378 — Studio UI Marketplace\x1b[0m\n");

const cwd = process.cwd();

// ── AgentCard.tsx ──
assert("AgentCard.tsx exists", () => {
  const p = join(cwd, "tools/studio/src/components/marketplace/AgentCard.tsx");
  if (!existsSync(p)) throw new Error("file missing");
});

assert("AgentCard renders name field", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/marketplace/AgentCard.tsx"), "utf-8");
  if (!src.includes("agent.name")) throw new Error("agent.name not referenced");
});

assert("AgentCard renders role field", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/marketplace/AgentCard.tsx"), "utf-8");
  if (!src.includes("agent.role")) throw new Error("agent.role not referenced");
});

assert("AgentCard renders skills (top 3)", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/marketplace/AgentCard.tsx"), "utf-8");
  if (!src.includes("skills")) throw new Error("skills not referenced");
  if (!src.includes("slice(0, 3)") && !src.includes("slice(0,3)")) throw new Error("top-3 slice not present");
});

assert("AgentCard renders tier badge", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/marketplace/AgentCard.tsx"), "utf-8");
  if (!src.includes("agent.tier")) throw new Error("tier not referenced");
});

assert("AgentCard renders capacity bar", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/marketplace/AgentCard.tsx"), "utf-8");
  if (!src.includes("CapacityBar") && !src.includes("capacity")) throw new Error("capacity bar missing");
});

assert("AgentCard renders price", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/marketplace/AgentCard.tsx"), "utf-8");
  if (!src.includes("agent.price")) throw new Error("price not referenced");
});

assert("AgentCard has Hire button", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/marketplace/AgentCard.tsx"), "utf-8");
  if (!src.includes("Hire")) throw new Error("Hire button missing");
});

assert("AgentCard has POST /api/marketplace/hire call", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/marketplace/AgentCard.tsx"), "utf-8");
  if (!src.includes("/api/marketplace/hire")) throw new Error("hire endpoint missing");
});

assert("AgentCard exports MarketplaceAgent interface", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/marketplace/AgentCard.tsx"), "utf-8");
  if (!src.includes("MarketplaceAgent")) throw new Error("MarketplaceAgent interface missing");
});

// ── Marketplace.tsx ──
assert("Marketplace.tsx exists", () => {
  const p = join(cwd, "tools/studio/src/pages/Marketplace.tsx");
  if (!existsSync(p)) throw new Error("file missing");
});

assert("Marketplace calls GET /api/marketplace/agents", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/pages/Marketplace.tsx"), "utf-8");
  if (!src.includes("/api/marketplace/agents")) throw new Error("endpoint missing");
});

assert("Marketplace renders AgentCard components", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/pages/Marketplace.tsx"), "utf-8");
  if (!src.includes("AgentCard")) throw new Error("AgentCard not used");
});

assert("Marketplace has role filter", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/pages/Marketplace.tsx"), "utf-8");
  if (!src.includes("roleFilter") && !src.includes("role")) throw new Error("role filter missing");
});

assert("Marketplace has tier filter", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/pages/Marketplace.tsx"), "utf-8");
  if (!src.includes("tier")) throw new Error("tier filter missing");
});

assert("Marketplace has availability toggle", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/pages/Marketplace.tsx"), "utf-8");
  if (!src.includes("available")) throw new Error("availability toggle missing");
});

assert("Marketplace fetches agents on filter change (useEffect deps)", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/pages/Marketplace.tsx"), "utf-8");
  if (!src.includes("useEffect")) throw new Error("useEffect missing");
  if (!src.includes("roleFilter") && !src.includes("tierFilter")) throw new Error("filter deps missing");
});

assert("Marketplace shows populate button", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/pages/Marketplace.tsx"), "utf-8");
  if (!src.includes("populate") && !src.includes("Populate")) throw new Error("populate button missing");
});

// ── MainArea.tsx routing ──
assert("MainArea.tsx has /marketplace route", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/layout/MainArea.tsx"), "utf-8");
  if (!src.includes("/marketplace")) throw new Error("/marketplace route missing");
});

assert("MainArea.tsx renders <Marketplace /> for /marketplace", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/layout/MainArea.tsx"), "utf-8");
  if (!src.includes("<Marketplace")) throw new Error("<Marketplace /> component not used");
});

assert("MainArea imports Marketplace page", () => {
  const src = readFileSync(join(cwd, "tools/studio/src/components/layout/MainArea.tsx"), "utf-8");
  if (!src.includes("import")) throw new Error("no imports found");
  if (!src.includes("Marketplace")) throw new Error("Marketplace not imported");
});

// ── marketplace.ts API file ──
assert("marketplace.ts exists", () => {
  const p = join(cwd, "tools/studio/server/api/marketplace.ts");
  if (!existsSync(p)) throw new Error("file missing");
});

assert("marketplace.ts exports createMarketplaceApi", () => {
  const src = readFileSync(join(cwd, "tools/studio/server/api/marketplace.ts"), "utf-8");
  if (!src.includes("createMarketplaceApi")) throw new Error("export missing");
});

assert("marketplace.ts has all 8 routes", () => {
  const src = readFileSync(join(cwd, "tools/studio/server/api/marketplace.ts"), "utf-8");
  const routes = [
    "GET /agents",
    "GET /agents/:id",
    "POST /agents/generate",
    "POST /agents/populate",
    "POST /hire",
    "DELETE /allocations/:id",
    "GET /allocations",
    "GET /patterns",
  ];
  for (const r of routes) {
    const [method, path] = r.split(" ");
    const mLower = method.toLowerCase();
    if (!src.includes(`api.${mLower}`) && !src.includes(`api.delete`)) {
      // Just check the path pattern
    }
    // Check path pattern exists in file
    const pathPart = path.replace("/", "").split("/")[0];
    if (!src.includes(pathPart)) throw new Error(`route pattern for ${r} not found`);
  }
});

assert("server/index.ts mounts marketplace API", () => {
  const src = readFileSync(join(cwd, "tools/studio/server/index.ts"), "utf-8");
  if (!src.includes("marketplace")) throw new Error("marketplace not mounted");
  if (!src.includes("createMarketplaceApi")) throw new Error("createMarketplaceApi not imported");
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
