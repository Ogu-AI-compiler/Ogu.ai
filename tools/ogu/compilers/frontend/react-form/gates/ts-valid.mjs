/**
 * Gate: ts-valid
 * Form.tsx must compile without TypeScript errors.
 */
import { existsSync } from "fs";
import { execSync } from "child_process";

export async function run({ dir, projectRoot }) {
  const formPath = `${dir}/Form.tsx`;
  if (!existsSync(formPath)) {
    return { pass: false, code: "RF003", message: "Form.tsx not found" };
  }

  const tscRoot = projectRoot || dir;
  const hasTsConfig = existsSync(`${tscRoot}/tsconfig.json`);
  if (!hasTsConfig) {
    return { pass: true, skipped: true, detail: { reason: "No tsconfig.json — skipping tsc check" } };
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
    const lines = output.split("\n").filter(l => l.includes(formPath)).slice(0, 10);
    return {
      pass: false,
      code: "RF003",
      message: `TypeScript errors in Form.tsx`,
      detail: { errors: lines },
    };
  }
}
