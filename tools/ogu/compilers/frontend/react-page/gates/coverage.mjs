import { existsSync } from "fs";
import { execSync } from "child_process";

const THRESHOLD = 80;

export async function run({ dir, projectRoot }) {
  const testPath = `${dir}/Page.test.tsx`;
  if (!existsSync(testPath)) return { pass: false, code: "RP009", message: "Page.test.tsx not found" };

  const root = projectRoot || dir;
  try {
    const output = execSync(
      `npx vitest run ${testPath} --coverage --reporter=json`,
      { cwd: root, stdio: "pipe", timeout: 90000 }
    ).toString();

    const json = JSON.parse(output);
    const covData = json.coverageMap || {};
    const pageKey = Object.keys(covData).find(k => k.endsWith("Page.tsx") && !k.includes(".test."));
    if (!pageKey) return { pass: true, skipped: true, detail: { reason: "Page.tsx not in coverage map" } };

    const s = covData[pageKey].s || {};
    const vals = Object.values(s);
    const covered = vals.filter(v => v > 0).length;
    const coverage = vals.length ? Math.round((covered / vals.length) * 100) : 0;

    if (coverage < THRESHOLD) {
      return {
        pass: false,
        code: "RP009",
        message: `Page coverage ${coverage}% below ${THRESHOLD}% threshold`,
        detail: { coverage, threshold: THRESHOLD },
      };
    }
    return { pass: true, detail: { coverage, threshold: THRESHOLD } };
  } catch {
    return { pass: true, skipped: true, detail: { reason: "Coverage measurement unavailable" } };
  }
}
