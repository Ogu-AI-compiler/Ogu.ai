import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../util.mjs";

const DAILY_TEMPLATE = (date) => `# ${date}

## Summary


## Actions

## Decisions

## Notes
`;

export async function log(overrideText) {
  const text = overrideText || process.argv.slice(3).join(" ").trim();
  if (!text) {
    console.error("Usage: ogu log \"your message here\"");
    return 1;
  }

  const root = repoRoot();
  const now = new Date();
  const date = fmt_date(now);
  const time = fmt_time(now);
  const entry = `- [${time}] ${text}`;

  // Append to daily log
  const memDir = join(root, ".ogu/memory");
  if (!existsSync(memDir)) {
    mkdirSync(memDir, { recursive: true });
  }

  const dailyPath = join(memDir, `${date}.md`);
  if (!existsSync(dailyPath)) {
    writeFileSync(dailyPath, DAILY_TEMPLATE(date), "utf-8");
  }

  let dailyContent = readFileSync(dailyPath, "utf-8");
  dailyContent = repairHeadings(dailyContent, date);
  const updatedDaily = appendToSection(dailyContent, "Actions", entry);
  writeFileSync(dailyPath, updatedDaily, "utf-8");

  // Append to SESSION.md
  const sessionPath = join(root, ".ogu/SESSION.md");
  if (existsSync(sessionPath)) {
    const sessionContent = readFileSync(sessionPath, "utf-8");
    writeFileSync(sessionPath, sessionContent.trimEnd() + `\n${entry}\n`, "utf-8");
  }

  console.log(`  logged  ${entry}`);
  console.log(`     to   .ogu/memory/${date}.md`);
  return 0;
}

const REQUIRED_HEADINGS = ["Summary", "Actions", "Decisions", "Notes"];

function repairHeadings(content, date) {
  // Ensure the title exists
  if (!content.includes("# ")) {
    content = `# ${date}\n\n${content}`;
  }
  // Ensure each required heading exists
  for (const h of REQUIRED_HEADINGS) {
    if (!content.includes(`## ${h}`)) {
      content = content.trimEnd() + `\n\n## ${h}\n`;
    }
  }
  return content;
}

function appendToSection(content, sectionName, entry) {
  const lines = content.split("\n");
  const header = `## ${sectionName}`;
  let idx = lines.findIndex((l) => l.trim() === header);

  if (idx === -1) {
    // Section missing — append it
    return content.trimEnd() + `\n\n${header}\n${entry}\n`;
  }

  // Find the end of this section (next ## or EOF)
  let insertAt = idx + 1;
  while (insertAt < lines.length && !lines[insertAt].startsWith("## ")) {
    insertAt++;
  }

  // Walk back over trailing blank lines so entry sits tight
  let pos = insertAt;
  while (pos > idx + 1 && lines[pos - 1].trim() === "") {
    pos--;
  }

  lines.splice(pos, 0, entry);
  return lines.join("\n");
}

function fmt_date(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmt_time(d) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
