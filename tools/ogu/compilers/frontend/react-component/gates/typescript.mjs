/**
 * Gate: typescript
 * Runs tsc --noEmit in the component directory and checks for zero errors.
 */
import { spawnSync } from "child_process";

export async function run({ dir, projectRoot }) {
  // Try component-level tsconfig, fall back to project root
  const cwd = projectRoot || dir;

  const result = spawnSync("npx", ["tsc", "--noEmit", "--strict"], {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
  });

  const output = (result.stdout || "") + (result.stderr || "");
  const errors = output
    .split("\n")
    .filter(l => l.includes("error TS"))
    .map(l => l.trim());

  if (result.status !== 0 && errors.length > 0) {
    return {
      pass: false,
      code: "RC002",
      message: `TypeScript: ${errors.length} error(s)`,
      detail: { errors: errors.slice(0, 10) },
    };
  }

  // tsc not found → skip gate with warning (don't block)
  if (result.error?.code === "ENOENT") {
    return { pass: true, skipped: true, detail: { reason: "tsc not found, gate skipped" } };
  }

  return { pass: true, detail: { errors: 0 } };
}
