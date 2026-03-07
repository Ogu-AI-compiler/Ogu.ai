import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../util.mjs";
import { validateAgainstContract } from "./lib/contract-schema-validator.mjs";
import { CONTRACT_TEMPLATES, generateContractDoc } from "./lib/contract-doc-generator.mjs";

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

  // Validate .contract.json files against their schemas (Phase 3E)
  const contractsDir = join(root, "docs/vault/02_Contracts");
  if (existsSync(contractsDir)) {
    try {
      const { readdirSync } = await import("node:fs");
      const contractJsonFiles = readdirSync(contractsDir).filter((f) => f.endsWith(".contract.json"));
      for (const file of contractJsonFiles) {
        try {
          const contractData = JSON.parse(readFileSync(join(contractsDir, file), "utf-8"));
          const templateName = file.replace(".contract.json", "");
          const template = CONTRACT_TEMPLATES.find((t) => t.name === templateName);
          if (template) {
            const result = validateAgainstContract({ contract: template, data: contractData });
            if (!result.valid) {
              for (const e of result.errors) {
                errors.push(`${file}: ${e}`);
              }
            }
          }
        } catch (e) {
          errors.push(`${file}: JSON parse error — ${e.message}`);
        }
      }
    } catch { /* skip if can't read dir */ }
  }

  if (errors.length > 0) {
    console.log("Contracts: INVALID\n");
    for (const e of errors) {
      console.log(`  ERROR  ${e}`);
    }
    return 1;
  }

  console.log("Contracts: VALID");
  // Show available contract templates count (Phase 3E)
  console.log(`  templates  ${CONTRACT_TEMPLATES.length} contract templates available`);
  return 0;
}
