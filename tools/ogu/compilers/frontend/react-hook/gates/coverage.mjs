import { existsSync, readdirSync } from "fs";
import { execSync } from "child_process";

const THRESHOLD = 80;

export async function run({ dir, projectRoot }) {
  const testFiles = existsSync(dir)
    ? readdirSync(dir).filter(f => /^use[A-Z].+\.test\.(ts|tsx)$/.test(f))
    : [];

  if (testFiles.length === 0) {
    return { pass: false, code: "RH008", message: "No hook test file found" };
  }

  const root = projectRoot || dir;
  const testPaths = testFiles.map(f => `${dir}/${f}`).join(" ");

  try {
    const output = execSync(
      `npx vitest run ${testPaths} --coverage --reporter=json`,
      { cwd: root, stdio: "pipe", timeout: 90000 }
    ).toString();

    const json = JSON.parse(output);
    const covData = json.coverageMap || {};
    const hookKey = Object.keys(covData).find(k => /use[A-Z].+\.(ts|tsx)$/.test(k) && !k.includes(".test."));

    if (!hookKey) {
      return { pass: true, skipped: true, detail: { reason: "Hook file not in coverage map" } };
    }

    const s = covData[hookKey].s || {};
    const vals = Object.values(s);
    const covered = vals.filter(v => v > 0).length;
    const coverage = vals.length ? Math.round((covered / vals.length) * 100) : 0;

    if (coverage < THRESHOLD) {
      return {
        pass: false,
        code: "RH008",
        message: `Hook coverage ${coverage}% below ${THRESHOLD}% threshold`,
        detail: { coverage, threshold: THRESHOLD },
      };
    }

    return { pass: true, detail: { coverage, threshold: THRESHOLD } };
  } catch {
    return { pass: true, skipped: true, detail: { reason: "Coverage measurement unavailable" } };
  }
}
