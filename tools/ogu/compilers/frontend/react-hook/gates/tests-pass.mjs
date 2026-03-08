/**
 * Gate: tests-pass
 * Hook tests must pass. Must use renderHook from @testing-library/react.
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { execSync } from "child_process";

export async function run({ dir, projectRoot }) {
  const testFiles = existsSync(dir)
    ? readdirSync(dir).filter(f => /^use[A-Z].+\.test\.(ts|tsx)$/.test(f))
    : [];

  if (testFiles.length === 0) {
    return { pass: false, code: "RH008", message: "No hook test file found (expected use*.test.ts)" };
  }

  // Verify renderHook is used
  for (const file of testFiles) {
    const content = readFileSync(`${dir}/${file}`, "utf8");
    if (!content.includes("renderHook")) {
      return {
        pass: false,
        code: "RH008",
        message: `${file} does not use renderHook — hook tests must use renderHook from @testing-library/react`,
      };
    }
  }

  const root = projectRoot || dir;
  const testPaths = testFiles.map(f => `${dir}/${f}`).join(" ");

  try {
    const output = execSync(
      `npx vitest run ${testPaths} --reporter=json`,
      { cwd: root, stdio: "pipe", timeout: 60000 }
    ).toString();

    const json = JSON.parse(output);
    const failed = json.testResults?.flatMap(r => r.assertionResults || []).filter(t => t.status === "failed") || [];

    if (failed.length) {
      return {
        pass: false,
        code: "RH008",
        message: `${failed.length} test(s) failed`,
        detail: { failed: failed.map(t => t.fullName) },
      };
    }

    return { pass: true, detail: { tests: json.numTotalTests } };
  } catch (err) {
    return {
      pass: false,
      code: "RH008",
      message: "Hook tests failed to run",
      detail: { error: (err.stdout?.toString() || err.message).slice(0, 500) },
    };
  }
}
