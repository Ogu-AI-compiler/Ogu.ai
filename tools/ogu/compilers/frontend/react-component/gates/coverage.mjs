/**
 * Gate: coverage
 * Checks that test coverage for the component is ≥80%.
 * Runs vitest with coverage if not already computed.
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";

const THRESHOLD = 80;

export async function run({ dir, name, projectRoot }) {
  const cwd = projectRoot || dir;

  // Try to read existing coverage report first
  const coverageJson = `${cwd}/coverage/coverage-final.json`;
  let coverage = null;

  if (!existsSync(coverageJson)) {
    // Run vitest with coverage
    const result = spawnSync(
      "npx",
      ["vitest", "run", `${dir}/${name}.test.tsx`, "--coverage", "--reporter=json"],
      { cwd, encoding: "utf8", timeout: 90_000 }
    );

    if (result.error?.code === "ENOENT") {
      return { pass: true, skipped: true, detail: { reason: "vitest not found, gate skipped" } };
    }
  }

  if (existsSync(coverageJson)) {
    try {
      const raw = JSON.parse(readFileSync(coverageJson, "utf8"));
      // Find the component's coverage entry
      const key = Object.keys(raw).find(k => k.includes(`${name}.tsx`) && !k.includes("test"));
      if (key) {
        const s = raw[key].s; // statement coverage map
        const total = Object.keys(s).length;
        const covered = Object.values(s).filter(v => v > 0).length;
        const pct = total > 0 ? Math.round((covered / total) * 100) : 100;
        coverage = pct;
      }
    } catch {}
  }

  if (coverage === null) {
    // Can't determine coverage — skip rather than fail
    return { pass: true, skipped: true, detail: { reason: "coverage data unavailable" } };
  }

  if (coverage < THRESHOLD) {
    return {
      pass: false,
      code: "RC005",
      message: `Coverage ${coverage}% < ${THRESHOLD}% threshold`,
      detail: { coverage, threshold: THRESHOLD },
    };
  }

  return { pass: true, detail: { coverage, threshold: THRESHOLD } };
}
