import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../util.mjs";

export async function adr() {
  const args = process.argv.slice(3);
  const title = extractPositional(args);
  const context = parseFlag(args, "--context") || "TODO";
  const decision = parseFlag(args, "--decision") || "TODO";
  const alternatives = parseFlag(args, "--alternatives") || "TODO";

  if (!title) {
    console.error('Usage: ogu adr "Title" [--context "..."] [--decision "..."] [--alternatives "..."]');
    return 1;
  }

  const root = repoRoot();
  const adrDir = join(root, "docs/vault/03_ADRs");
  if (!existsSync(adrDir)) {
    mkdirSync(adrDir, { recursive: true });
  }

  // Determine next number
  const nextNum = getNextNumber(adrDir);
  const padded = String(nextNum).padStart(4, "0");
  const slug = slugify(title);
  const filename = `ADR_${padded}_${slug}.md`;
  const relPath = `docs/vault/03_ADRs/${filename}`;
  const fullPath = join(root, relPath);

  // Write ADR
  const content = `# ADR ${padded} — ${title}

## Status
Proposed

## Context
${context}

## Decision
${decision}

## Alternatives
${alternatives}

## Consequences
TODO

## Links
`;

  writeFileSync(fullPath, content, "utf-8");
  console.log(`  created  ${relPath}`);

  // Update 00_Index.md
  updateIndex(root, padded, title, relPath);

  // Update STATE.json recent_adrs
  updateState(root, filename);

  return 0;
}

function getNextNumber(adrDir) {
  const files = readdirSync(adrDir);
  let max = 0;
  for (const f of files) {
    const match = f.match(/^ADR_(\d{4})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return max + 1;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function updateIndex(root, padded, title, relPath) {
  const indexPath = join(root, "docs/vault/00_Index.md");
  if (!existsSync(indexPath)) return;

  let content = readFileSync(indexPath, "utf-8");
  const entry = `- [ADR ${padded} — ${title}](${relPath})`;

  // Append under ADRs section if it exists, otherwise append at end
  if (content.includes("## ADRs")) {
    // Find end of ADRs section (next ## or EOF)
    const lines = content.split("\n");
    const sectionIdx = lines.findIndex((l) => l.trim() === "## ADRs");
    let insertAt = sectionIdx + 1;
    while (insertAt < lines.length && !lines[insertAt].startsWith("## ")) {
      insertAt++;
    }
    // Walk back over trailing blank lines
    let pos = insertAt;
    while (pos > sectionIdx + 1 && lines[pos - 1].trim() === "") {
      pos--;
    }
    lines.splice(pos, 0, entry);
    content = lines.join("\n");
  } else {
    content = content.trimEnd() + `\n\n## ADRs\n\n${entry}\n`;
  }

  writeFileSync(indexPath, content, "utf-8");
  console.log("  updated  docs/vault/00_Index.md");
}

function updateState(root, filename) {
  const statePath = join(root, ".ogu/STATE.json");
  if (!existsSync(statePath)) return;

  try {
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    if (!Array.isArray(state.recent_adrs)) {
      state.recent_adrs = [];
    }
    state.recent_adrs.push(filename);
    // Keep max 10
    if (state.recent_adrs.length > 10) {
      state.recent_adrs = state.recent_adrs.slice(-10);
    }
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
    console.log("  updated  .ogu/STATE.json");
  } catch { /* leave as-is */ }
}

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function extractPositional(args) {
  // First arg that doesn't start with -- and isn't a value of a flag
  const flags = new Set(["--context", "--decision", "--alternatives"]);
  for (let i = 0; i < args.length; i++) {
    if (flags.has(args[i])) {
      i++; // skip value
      continue;
    }
    if (!args[i].startsWith("--")) {
      return args[i];
    }
  }
  return null;
}
