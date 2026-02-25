import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../util.mjs";

export async function remember() {
  const root = repoRoot();
  const args = process.argv.slice(3);
  const applyMode = args.includes("--apply");
  const autoMode = args.includes("--auto");
  const pruneMode = args.includes("--prune");

  const memoryPath = join(root, ".ogu/MEMORY.md");
  const memoryContent = existsSync(memoryPath)
    ? readFileSync(memoryPath, "utf-8")
    : "";

  // Prune mode: remove duplicates, stale entries, enforce max lines
  if (pruneMode) {
    const result = pruneMemory(memoryPath, memoryContent);
    if (result.removed === 0) {
      console.log("  prune    MEMORY.md is clean, nothing to remove.");
    } else {
      console.log(`  prune    Removed ${result.removed} entries (${result.duplicates} duplicates, ${result.stale} stale)`);
      console.log(`  prune    ${result.remaining} entries remaining`);
    }
    return 0;
  }

  // Auto mode: skip proposal, auto-curate from daily logs
  if (autoMode) {
    const autoCandidates = autoDetectPatterns(root, memoryContent);
    if (autoCandidates.length === 0) {
      console.log("  auto     No recurring patterns found in recent logs.");
      return 0;
    }

    let updated = memoryContent;
    if (!updated.endsWith("\n")) updated += "\n";
    for (const ac of autoCandidates) {
      updated += `- ${ac} [auto]\n`;
    }
    writeFileSync(memoryPath, updated, "utf-8");
    console.log(`  auto     ${autoCandidates.length} pattern(s) auto-added to .ogu/MEMORY.md`);
    return 0;
  }

  // Read SESSION.md
  const sessionPath = join(root, ".ogu/SESSION.md");
  const sessionContent = existsSync(sessionPath)
    ? readFileSync(sessionPath, "utf-8")
    : "";

  // Read today's daily log
  const today = fmtDate(new Date());
  const dailyPath = join(root, `.ogu/memory/${today}.md`);
  const dailyContent = existsSync(dailyPath)
    ? readFileSync(dailyPath, "utf-8")
    : "";

  if (!sessionContent.trim() && !dailyContent.trim()) {
    console.log("  Nothing to remember — SESSION.md and today's log are empty.");
    return 0;
  }

  // Extract facts
  const decisions = extractSection(dailyContent, "Decisions");
  const actions = extractSection(dailyContent, "Actions");
  const notes = extractSection(dailyContent, "Notes");
  const sessionLines = extractBullets(sessionContent);

  // Existing memory bullets for dedup
  const existingMemory = new Set(
    extractBullets(memoryContent).map((l) => normalize(l))
  );

  // Build candidates (dedup across all sources)
  const candidates = [];
  const seen = new Set();

  function addCandidate(fact) {
    if (!fact) return;
    const key = normalize(fact);
    if (existingMemory.has(key) || seen.has(key)) return;
    seen.add(key);
    candidates.push(fact);
  }

  for (const line of decisions) {
    addCandidate(bulletToFact(line));
  }

  for (const line of notes) {
    addCandidate(bulletToFact(line));
  }

  // Actions that look like conventions or patterns (not one-off tasks)
  for (const line of actions) {
    if (looksLikeConvention(line)) {
      addCandidate(bulletToFact(line));
    }
  }

  // Session lines that look like decisions or facts
  for (const line of sessionLines) {
    if (looksLikeDecision(line) || looksLikeConvention(line)) {
      addCandidate(bulletToFact(line));
    }
  }

  // Build proposal
  const proposal = buildProposal(candidates, today);
  const proposalPath = join(root, ".ogu/MEMORY_PROPOSAL.md");
  writeFileSync(proposalPath, proposal, "utf-8");

  console.log(`  created  .ogu/MEMORY_PROPOSAL.md (${candidates.length} candidate${candidates.length !== 1 ? "s" : ""})`);

  // Apply mode: automatically apply ADD candidates to MEMORY.md
  if (applyMode && candidates.length > 0) {
    let updated = memoryContent;
    if (!updated.endsWith("\n")) updated += "\n";

    let applied = 0;
    for (const c of candidates) {
      // Double-check dedup (normalize comparison)
      const key = normalize(c);
      if (!existingMemory.has(key)) {
        updated += `- ${c}\n`;
        applied++;
      }
    }

    if (applied > 0) {
      writeFileSync(memoryPath, updated, "utf-8");
      console.log(`  applied  ${applied} entries to .ogu/MEMORY.md`);
    } else {
      console.log("  applied  0 entries (all duplicates)");
    }
  } else if (!applyMode) {
    console.log("  Review the proposal and apply changes to .ogu/MEMORY.md");
    console.log("  Or use --apply to auto-apply: ogu remember --apply");
  }

  return 0;
}

// ---------------------------------------------------------------------------

function autoDetectPatterns(root, existingMemory) {
  const memDir = join(root, ".ogu/memory");
  if (!existsSync(memDir)) return [];

  const logFiles = readdirSync(memDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .slice(0, 5);

  if (logFiles.length < 2) return []; // Need at least 2 logs for pattern detection

  const existingSet = new Set(
    extractBullets(existingMemory).map((l) => normalize(l))
  );

  // Count fact occurrences across logs
  const factCounts = new Map();

  for (const file of logFiles) {
    const content = readFileSync(join(memDir, file), "utf-8");
    const bullets = [
      ...extractSection(content, "Decisions"),
      ...extractSection(content, "Notes"),
      ...extractSection(content, "Actions").filter(looksLikeConvention),
    ];

    const seenInThisLog = new Set();
    for (const b of bullets) {
      const fact = bulletToFact(b);
      if (!fact) continue;
      const key = normalize(fact);

      // Skip if already in memory
      if (existingSet.has(key)) continue;
      // Skip if already counted in this log
      if (seenInThisLog.has(key)) continue;
      seenInThisLog.add(key);

      if (factCounts.has(key)) {
        factCounts.get(key).count++;
      } else {
        factCounts.set(key, { count: 1, fact });
      }
    }
  }

  // Return facts that appear in 3+ logs
  return [...factCounts.values()]
    .filter((v) => v.count >= 3)
    .map((v) => v.fact);
}

// ---------------------------------------------------------------------------

function buildProposal(candidates, date) {
  let md = `# Memory Proposal — ${date}\n\n`;
  md += `> Generated by \`ogu remember\`. Use \`ogu remember --apply\` to auto-apply.\n`;
  md += `> This file is safe to delete after review.\n\n`;

  md += `## ADD:\n\n`;
  if (candidates.length === 0) {
    md += `No new facts to add.\n`;
  } else {
    for (const c of candidates) {
      md += `- ${c}\n`;
    }
  }

  md += `\n## REMOVE:\n\n`;
  md += `<!-- Review .ogu/MEMORY.md for outdated entries to remove -->\n`;

  md += `\n## UPDATE:\n\n`;
  md += `<!-- Review .ogu/MEMORY.md for entries that need updating -->\n`;

  return md;
}

function extractSection(content, sectionName) {
  if (!content) return [];
  const lines = content.split("\n");
  const header = `## ${sectionName}`;
  let inSection = false;
  const result = [];

  for (const line of lines) {
    if (line.trim() === header) {
      inSection = true;
      continue;
    }
    if (inSection && /^## /.test(line)) break;
    if (inSection) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") && trimmed.length > 2) {
        result.push(trimmed);
      }
    }
  }
  return result;
}

function extractBullets(content) {
  if (!content) return [];
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- ") && l.length > 2);
}

function bulletToFact(line) {
  // Strip bullet prefix and timestamp
  let text = line.replace(/^- /, "").replace(/^\[\d{2}:\d{2}\]\s*/, "").trim();
  if (text.length < 5) return null;
  return text;
}

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function looksLikeDecision(line) {
  const lower = line.toLowerCase();
  return (
    lower.includes("decided") ||
    lower.includes("decision") ||
    lower.includes("chose") ||
    lower.includes("chosen") ||
    lower.includes("will use") ||
    lower.includes("switched to") ||
    lower.includes("prefer") ||
    lower.includes(" — ")
  );
}

function looksLikeConvention(line) {
  const lower = line.toLowerCase();
  return (
    lower.includes("always") ||
    lower.includes("never") ||
    lower.includes("convention") ||
    lower.includes("pattern") ||
    lower.includes("standard") ||
    lower.includes("must ") ||
    lower.includes("rule:") ||
    lower.includes("use ") ||
    lower.includes("configured") ||
    lower.includes("setup") ||
    lower.includes("installed")
  );
}

function pruneMemory(memoryPath, content) {
  if (!content.trim()) return { removed: 0, duplicates: 0, stale: 0, remaining: 0 };

  const lines = content.split("\n");
  const result = [];
  const seen = new Set();
  let duplicates = 0;
  let stale = 0;
  const MAX_ENTRIES = 150;

  for (const line of lines) {
    const trimmed = line.trim();

    // Keep non-bullet lines (headers, blank lines, etc.)
    if (!trimmed.startsWith("- ")) {
      result.push(line);
      continue;
    }

    // Normalize for dedup
    const key = normalize(trimmed.replace(/^- /, "").replace(/\[auto\]/g, "").trim());

    // Skip duplicates
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);

    // Skip stale entries (marked with [stale] or very short/empty)
    const text = trimmed.replace(/^- /, "").trim();
    if (text.length < 5 || text === "[auto]") {
      stale++;
      continue;
    }

    result.push(line);
  }

  // Enforce max entries: keep most recent (bottom of file)
  const bullets = result.filter((l) => l.trim().startsWith("- "));
  const nonBullets = result.filter((l) => !l.trim().startsWith("- "));
  let trimmedBullets = 0;

  let finalBullets = bullets;
  if (bullets.length > MAX_ENTRIES) {
    trimmedBullets = bullets.length - MAX_ENTRIES;
    stale += trimmedBullets;
    finalBullets = bullets.slice(trimmedBullets);
  }

  // Rebuild
  const final = [...nonBullets, ...finalBullets].join("\n");
  const totalRemoved = duplicates + stale;

  if (totalRemoved > 0) {
    writeFileSync(memoryPath, final, "utf-8");
  }

  return {
    removed: totalRemoved,
    duplicates,
    stale,
    remaining: finalBullets.length,
  };
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
