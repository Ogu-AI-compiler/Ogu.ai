/**
 * Gate: tests-pass
 * Form unit tests must all pass.
 */
import { existsSync } from "fs";
import { execSync } from "child_process";

export async function run({ dir, projectRoot }) {
  const testPath = `${dir}/Form.test.tsx`;
  if (!existsSync(testPath)) {
    return { pass: false, code: "RF008", message: "Form.test.tsx not found" };
  }

  const root = projectRoot || dir;
  try {
    const output = execSync(
      `npx vitest run ${testPath} --reporter=json`,
      { cwd: root, stdio: "pipe", timeout: 60000 }
    ).toString();

    const json = JSON.parse(output);
    const failed = json.testResults?.flatMap(r => r.assertionResults || []).filter(t => t.status === "failed") || [];

    if (failed.length) {
      return {
        pass: false,
        code: "RF008",
        message: `${failed.length} test(s) failed`,
        detail: { failed: failed.map(t => t.fullName) },
      };
    }

    return { pass: true, detail: { tests: json.numTotalTests } };
  } catch (err) {
    const output = err.stdout?.toString() || err.message;
    return {
      pass: false,
      code: "RF008",
      message: "Form tests failed to run",
      detail: { error: output.slice(0, 500) },
    };
  }
}
