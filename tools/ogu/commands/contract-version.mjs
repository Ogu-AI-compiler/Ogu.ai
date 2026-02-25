import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";

const CONTRACTS_DIR = "docs/vault/02_Contracts";

export async function contractVersion() {
  const args = process.argv.slice(3);
  const bump = parseFlag(args, "--bump") || "patch";
  const summary = parseFlag(args, "--summary") || "";
  const syncDocs = args.includes("--sync-docs");

  // Target: specific file or all .contract.json files
  const target = args.find((a) => !a.startsWith("--") && args.indexOf(a) !== args.indexOf(parseFlag(args, "--bump")) && args.indexOf(a) !== args.indexOf(parseFlag(args, "--summary")));

  const root = repoRoot();
  const contractsDir = join(root, CONTRACTS_DIR);

  if (!existsSync(contractsDir)) {
    console.error(`  ERROR  Contracts directory not found: ${CONTRACTS_DIR}`);
    return 1;
  }

  // Find target files
  let files;
  if (target) {
    const full = target.startsWith("/") ? target : join(root, target);
    if (!existsSync(full)) {
      console.error(`  ERROR  File not found: ${target}`);
      return 1;
    }
    files = [full];
  } else {
    files = readdirSync(contractsDir)
      .filter((f) => f.endsWith(".contract.json"))
      .map((f) => join(contractsDir, f));
  }

  if (files.length === 0) {
    console.error("  ERROR  No .contract.json files found. Create them first.");
    return 1;
  }

  let updated = 0;
  for (const file of files) {
    const relPath = file.startsWith(root) ? file.slice(root.length + 1) : file;
    const contract = readJsonSafe(file);
    if (!contract) {
      console.log(`  skip     ${relPath} (invalid JSON)`);
      continue;
    }

    const oldVersion = contract.version || "0.0.0";
    const newVersion = bumpVersion(oldVersion, bump);

    contract.version = newVersion;
    contract.last_updated = new Date().toISOString();

    if (!Array.isArray(contract.changelog)) {
      contract.changelog = [];
    }
    contract.changelog.unshift({
      version: newVersion,
      date: new Date().toISOString().split("T")[0],
      summary: summary || `Bumped ${bump} from ${oldVersion}`,
    });

    writeFileSync(file, JSON.stringify(contract, null, 2) + "\n", "utf-8");
    console.log(`  bumped   ${relPath}  ${oldVersion} → ${newVersion}`);
    updated++;

    if (syncDocs) {
      syncMarkdownFromSchema(root, file, contract);
    }
  }

  console.log(`\n  ${updated} contract(s) updated`);
  return 0;
}

// ---------------------------------------------------------------------------

function bumpVersion(version, type) {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "1.0.0";

  switch (type) {
    case "major": return `${parts[0] + 1}.0.0`;
    case "minor": return `${parts[0]}.${parts[1] + 1}.0`;
    case "patch":
    default: return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

function syncMarkdownFromSchema(root, jsonPath, contract) {
  const name = basename(jsonPath, ".contract.json");
  const mdMap = {
    api: "API_Contracts.md",
    navigation: "Navigation_Contract.md",
    design: "Design_System_Contract.md",
  };

  const mdFile = mdMap[name];
  if (!mdFile) return;

  const mdPath = join(root, CONTRACTS_DIR, mdFile);
  let md = `# ${mdFile.replace(".md", "").replace(/_/g, " ")}\n\n`;
  md += `> Auto-generated from \`${name}.contract.json\` v${contract.version}\n`;
  md += `> Last updated: ${contract.last_updated}\n\n`;

  if (name === "api" && contract.endpoints) {
    md += "## Endpoints\n\n";
    for (const ep of contract.endpoints) {
      md += `### \`${ep.method} ${ep.path}\`\n\n`;
      if (ep.description) md += `${ep.description}\n\n`;
      if (ep.errors && ep.errors.length > 0) {
        md += `Error codes: ${ep.errors.join(", ")}\n\n`;
      }
    }
    if (contract.models) {
      md += "## Models\n\n";
      for (const [modelName, schema] of Object.entries(contract.models)) {
        md += `### ${modelName}\n\n`;
        if (schema.properties) {
          md += "| Field | Type | Required |\n|---|---|---|\n";
          for (const [field, def] of Object.entries(schema.properties)) {
            const req = (schema.required || []).includes(field) ? "yes" : "no";
            md += `| ${field} | ${def.type || "any"} | ${req} |\n`;
          }
          md += "\n";
        }
      }
    }
  }

  if (name === "navigation" && contract.routes) {
    md += "## Routes\n\n";
    md += renderRoutes(contract.routes, 0);
  }

  if (name === "design") {
    if (contract.colors) {
      md += "## Colors\n\n";
      for (const [token, val] of Object.entries(contract.colors)) {
        md += `- \`${token}\`: ${val}\n`;
      }
      md += "\n";
    }
    if (contract.spacing) {
      md += "## Spacing\n\n";
      for (const [token, val] of Object.entries(contract.spacing)) {
        md += `- \`${token}\`: ${val}\n`;
      }
      md += "\n";
    }
    if (contract.typography) {
      md += "## Typography\n\n";
      for (const [token, val] of Object.entries(contract.typography)) {
        md += `- \`${token}\`: size=${val.size}, weight=${val.weight}\n`;
      }
      md += "\n";
    }
  }

  writeFileSync(mdPath, md, "utf-8");
  console.log(`  synced   ${CONTRACTS_DIR}/${mdFile}`);
}

function renderRoutes(routes, depth) {
  let md = "";
  const indent = "  ".repeat(depth);
  for (const route of routes) {
    md += `${indent}- \`${route.path}\` → ${route.component || "—"}`;
    if (route.auth_required) md += " (auth)";
    md += "\n";
    if (route.children) {
      md += renderRoutes(route.children, depth + 1);
    }
  }
  return md;
}

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}
