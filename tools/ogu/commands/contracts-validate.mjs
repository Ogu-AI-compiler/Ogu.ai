import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../util.mjs";

const CONTRACT_FILES = [
  "docs/vault/02_Contracts/API_Contracts.md",
  "docs/vault/02_Contracts/Navigation_Contract.md",
  "docs/vault/02_Contracts/Design_System_Contract.md",
  "docs/vault/01_Architecture/Patterns.md",
];

export async function contractsValidate() {
  const root = repoRoot();
  const errors = [];

  for (const relPath of CONTRACT_FILES) {
    const full = join(root, relPath);
    if (!existsSync(full)) {
      errors.push(`Missing: ${relPath}`);
      continue;
    }
    const content = readFileSync(full, "utf-8");
    if (content.includes("TODO")) {
      errors.push(`${relPath} contains TODO markers`);
    }
  }

  if (errors.length > 0) {
    console.log("Contracts: INVALID\n");
    for (const e of errors) {
      console.log(`  ERROR  ${e}`);
    }
    return 1;
  }

  console.log("Contracts: VALID");
  return 0;
}
