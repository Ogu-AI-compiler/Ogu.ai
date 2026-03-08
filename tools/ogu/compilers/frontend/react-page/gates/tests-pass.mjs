import { existsSync } from "fs";
import { execSync } from "child_process";

export async function run({ dir, projectRoot }) {
  const testPath = `${dir}/Page.test.tsx`;
  if (!existsSync(testPath)) {
    return { pass: false, code: "RP009", message: "Page.test.tsx not found" };
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
        code: "RP009",
        message: `${failed.length} test(s) failed`,
        detail: { failed: failed.map(t => t.fullName) },
      };
    }

    return { pass: true, detail: { tests: json.numTotalTests } };
  } catch (err) {
    return {
      pass: false,
      code: "RP009",
      message: "Page tests failed to run",
      detail: { error: (err.stdout?.toString() || err.message).slice(0, 500) },
    };
  }
}
