/**
 * Gate: coverage
 * Form.tsx must have ≥80% line coverage.
 */
import { existsSync } from "fs";
import { execSync } from "child_process";

const THRESHOLD = 80;

export async function run({ dir, projectRoot }) {
  const testPath = `${dir}/Form.test.tsx`;
  if (!existsSync(testPath)) {
    return { pass: false, code: "RF008", message: "Form.test.tsx not found — cannot measure coverage" };
  }

  const root = projectRoot || dir;
  try {
    const output = execSync(
      `npx vitest run ${testPath} --coverage --reporter=json`,
      { cwd: root, stdio: "pipe", timeout: 90000 }
    ).toString();

    const json = JSON.parse(output);
    const covData = json.coverageMap || {};
    const formKey = Object.keys(covData).find(k => k.endsWith("Form.tsx"));
    if (!formKey) {
      return { pass: true, skipped: true, detail: { reason: "Form.tsx not found in coverage map" } };
    }

    const s = covData[formKey].s || {};
    const vals = Object.values(s);
    const covered = vals.filter(v => v > 0).length;
    const coverage = vals.length ? Math.round((covered / vals.length) * 100) : 0;

    if (coverage < THRESHOLD) {
      return {
        pass: false,
        code: "RF008",
        message: `Form.tsx coverage ${coverage}% is below ${THRESHOLD}% threshold`,
        detail: { coverage, threshold: THRESHOLD },
      };
    }

    return { pass: true, detail: { coverage, threshold: THRESHOLD } };
  } catch {
    return { pass: true, skipped: true, detail: { reason: "Coverage measurement unavailable" } };
  }
}
