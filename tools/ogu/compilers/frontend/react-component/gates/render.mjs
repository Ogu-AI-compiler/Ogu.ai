/**
 * Gate: render
 * Verifies the component test file runs without render errors.
 * Runs the test file via vitest and checks for "X passed".
 */
import { spawnSync } from "child_process";
import { existsSync } from "fs";

export async function run({ dir, name, projectRoot }) {
  const testFile = `${dir}/${name}.test.tsx`;
  if (!existsSync(testFile)) {
    return { pass: false, code: "RC003", message: `Test file not found: ${name}.test.tsx` };
  }

  const cwd = projectRoot || dir;
  const result = spawnSync(
    "npx",
    ["vitest", "run", testFile, "--reporter=json"],
    { cwd, encoding: "utf8", timeout: 60_000 }
  );

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  // Parse JSON reporter output
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    // Fall back to text parsing
    if (stdout.includes("FAIL") || result.status !== 0) {
      const errors = stderr.split("\n").filter(l => l.includes("Error") || l.includes("FAIL")).slice(0, 5);
      return { pass: false, code: "RC003", message: "Component renders with errors", detail: { errors } };
    }
    return { pass: true, detail: { note: "text output only" } };
  }

  const numFailed = parsed?.numFailedTests ?? 0;
  const numPassed = parsed?.numPassedTests ?? 0;

  if (numFailed > 0) {
    const failures = (parsed?.testResults || [])
      .flatMap(r => r.assertionResults || [])
      .filter(t => t.status === "failed")
      .map(t => ({ title: t.title, message: (t.failureMessages || []).join("\n").slice(0, 200) }));

    return {
      pass: false,
      code: "RC003",
      message: `${numFailed} test(s) failed`,
      detail: { failures: failures.slice(0, 5) },
    };
  }

  return { pass: true, detail: { passed: numPassed } };
}
