/**
 * Gate: ts-valid
 * Hook file must compile without TypeScript errors.
 */
import { existsSync, readdirSync } from "fs";
import { execSync } from "child_process";

export async function run({ dir, projectRoot }) {
  const hookFiles = existsSync(dir)
    ? readdirSync(dir).filter(f => /^use[A-Z].+\.(ts|tsx)$/.test(f) && !f.includes(".test."))
    : [];

  if (hookFiles.length === 0) {
    return { pass: false, code: "RH003", message: "No hook file found to typecheck" };
  }

  const tscRoot = projectRoot || dir;
  if (!existsSync(`${tscRoot}/tsconfig.json`)) {
    return { pass: true, skipped: true, detail: { reason: "No tsconfig.json — skipping tsc" } };
  }

  try {
    execSync(`npx tsc --noEmit --project ${tscRoot}/tsconfig.json`, {
      cwd: tscRoot,
      stdio: "pipe",
      timeout: 30000,
    });
    return { pass: true };
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    const relevant = output.split("\n").filter(l => hookFiles.some(f => l.includes(f))).slice(0, 10);
    return {
      pass: false,
      code: "RH003",
      message: "TypeScript errors in hook file",
      detail: { errors: relevant },
    };
  }
}
