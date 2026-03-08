import { existsSync } from "fs";
import { execSync } from "child_process";

export async function run({ dir, projectRoot }) {
  if (!existsSync(`${dir}/Page.tsx`) && !existsSync(`${dir}`)) {
    return { pass: false, code: "RP003", message: "Page.tsx not found" };
  }

  const tscRoot = projectRoot || dir;
  if (!existsSync(`${tscRoot}/tsconfig.json`)) {
    return { pass: true, skipped: true, detail: { reason: "No tsconfig.json — skipping tsc" } };
  }

  try {
    execSync(`npx tsc --noEmit --project ${tscRoot}/tsconfig.json`, {
      cwd: tscRoot, stdio: "pipe", timeout: 30000,
    });
    return { pass: true };
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    const relevant = output.split("\n").filter(l => l.includes("Page.tsx")).slice(0, 10);
    return {
      pass: false,
      code: "RP003",
      message: "TypeScript errors in Page.tsx",
      detail: { errors: relevant },
    };
  }
}
