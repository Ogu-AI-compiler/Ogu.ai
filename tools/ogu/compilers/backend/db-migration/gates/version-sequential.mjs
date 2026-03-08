import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";

export async function run({ dir }) {
  const specPath = `${dir}/migration-spec.json`;
  if (!existsSync(specPath)) {
    return { pass: false, code: "DM011", message: "migration-spec.json not found" };
  }

  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const version = String(spec.version || "");

  if (!/^\d{3,}$/.test(version)) {
    return {
      pass: false,
      code: "DM011",
      message: `Version must be zero-padded integer (e.g. "001"). Got: "${version}"`,
    };
  }

  // Scan sibling migration directories for version conflicts
  const featureDir = dirname(dir);
  let siblingVersions = [];

  try {
    const siblings = readdirSync(featureDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== dir.split("/").pop())
      .map(d => join(featureDir, d.name, "migration-spec.json"))
      .filter(existsSync)
      .map(p => {
        try { return JSON.parse(readFileSync(p, "utf8")).version; } catch { return null; }
      })
      .filter(Boolean)
      .map(String);

    siblingVersions = siblings;
  } catch {
    // Can't read siblings — not a blocking error
  }

  if (siblingVersions.includes(version)) {
    return {
      pass: false,
      code: "DM011",
      message: `Version "${version}" conflicts with an existing migration in this feature`,
      detail: { existing: siblingVersions, conflicting: version },
    };
  }

  // Check for gaps: if other versions exist, this one should be max+1
  if (siblingVersions.length > 0) {
    const nums = siblingVersions.map(Number).sort((a, b) => a - b);
    const maxExisting = nums[nums.length - 1];
    const thisNum = Number(version);
    if (thisNum !== maxExisting + 1 && thisNum > maxExisting + 1) {
      return {
        pass: false,
        code: "DM011",
        message: `Version gap: existing migrations go up to ${String(maxExisting).padStart(version.length, "0")}, but this is ${version}`,
        detail: { existing: siblingVersions, expected: String(maxExisting + 1).padStart(version.length, "0") },
      };
    }
  }

  return {
    pass: true,
    detail: { version, siblings: siblingVersions.length },
  };
}
