import { existsSync, readFileSync, readdirSync, unlinkSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";

export async function clean() {
  const args = process.argv.slice(3);
  const dryRun = args.includes("--dry-run");
  const all = args.includes("--all");
  const logsFlag = parseFlag(args, "--logs");
  const logDays = logsFlag ? parseInt(logsFlag, 10) : (all ? 30 : null);
  const cleanOrchestrate = all || args.includes("--orchestrate");
  const cleanVision = all || args.includes("--vision");
  const cleanReports = all || args.includes("--reports");

  if (!logDays && !cleanOrchestrate && !cleanVision && !cleanReports) {
    console.log("Usage: ogu clean [options]");
    console.log("");
    console.log("  --all                Clean everything (default: 30 day retention)");
    console.log("  --logs <days>        Remove daily logs older than N days (default: 30)");
    console.log("  --orchestrate        Remove orchestration files for completed features");
    console.log("  --vision             Remove old vision screenshots and reports");
    console.log("  --reports            Remove generated reports (DOCTOR.md, TRENDS.md, etc.)");
    console.log("  --dry-run            Show what would be cleaned without deleting");
    return 0;
  }

  const root = repoRoot();
  const mode = dryRun ? "DRY RUN" : "CLEANING";
  console.log(`  mode     ${mode}\n`);

  let totalFiles = 0;
  let totalBytes = 0;

  // Clean old daily logs
  if (logDays) {
    const result = cleanDailyLogs(root, logDays, dryRun);
    totalFiles += result.files;
    totalBytes += result.bytes;
  }

  // Clean orchestration files for completed features
  if (cleanOrchestrate) {
    const result = cleanOrchestration(root, dryRun);
    totalFiles += result.files;
    totalBytes += result.bytes;
  }

  // Clean old vision artifacts
  if (cleanVision) {
    const result = cleanVisionArtifacts(root, dryRun);
    totalFiles += result.files;
    totalBytes += result.bytes;
  }

  // Clean generated reports
  if (cleanReports) {
    const result = cleanGeneratedReports(root, dryRun);
    totalFiles += result.files;
    totalBytes += result.bytes;
  }

  // Summary
  console.log("");
  if (totalFiles === 0) {
    console.log("  Nothing to clean.");
  } else {
    const sizeStr = formatBytes(totalBytes);
    console.log(`  total    ${totalFiles} file(s), ${sizeStr}`);
    if (dryRun) {
      console.log("  (dry run — nothing was deleted)");
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------

function cleanDailyLogs(root, days, dryRun) {
  const logDir = join(root, ".ogu/memory");
  if (!existsSync(logDir)) return { files: 0, bytes: 0 };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  let files = 0;
  let bytes = 0;

  try {
    for (const file of readdirSync(logDir)) {
      if (!file.endsWith(".md")) continue;

      // Parse date from filename (YYYY-MM-DD.md)
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
      if (!dateMatch) continue;

      const fileDate = new Date(dateMatch[1]);
      if (fileDate < cutoff) {
        const fullPath = join(logDir, file);
        const size = getFileSize(fullPath);
        console.log(`  logs     ${dryRun ? "(would remove)" : "removed"} ${file} (${formatBytes(size)})`);
        if (!dryRun) unlinkSync(fullPath);
        files++;
        bytes += size;
      }
    }
  } catch { /* skip */ }

  if (files === 0) {
    console.log(`  logs     nothing older than ${days} days`);
  }

  return { files, bytes };
}

function cleanOrchestration(root, dryRun) {
  const orchDir = join(root, ".ogu/orchestrate");
  if (!existsSync(orchDir)) return { files: 0, bytes: 0 };

  // Load metrics to find completed features
  const metrics = readJsonSafe(join(root, ".ogu/METRICS.json"));
  const completedFeatures = new Set();
  if (metrics?.features) {
    for (const [slug, data] of Object.entries(metrics.features)) {
      if (data.completed) completedFeatures.add(slug);
    }
  }

  let files = 0;
  let bytes = 0;

  try {
    for (const slug of readdirSync(orchDir)) {
      if (!completedFeatures.has(slug)) continue;

      const slugDir = join(orchDir, slug);
      const size = getDirSize(slugDir);
      console.log(`  orch     ${dryRun ? "(would remove)" : "removed"} ${slug}/ (${formatBytes(size)})`);
      if (!dryRun) rmSync(slugDir, { recursive: true, force: true });
      files++;
      bytes += size;
    }
  } catch { /* skip */ }

  if (files === 0) {
    console.log("  orch     nothing to clean (no completed features)");
  }

  return { files, bytes };
}

function cleanVisionArtifacts(root, dryRun) {
  const visionDir = join(root, ".ogu/vision");
  if (!existsSync(visionDir)) return { files: 0, bytes: 0 };

  // Load metrics to find completed features
  const metrics = readJsonSafe(join(root, ".ogu/METRICS.json"));
  const completedFeatures = new Set();
  if (metrics?.features) {
    for (const [slug, data] of Object.entries(metrics.features)) {
      if (data.completed) completedFeatures.add(slug);
    }
  }

  let files = 0;
  let bytes = 0;

  try {
    for (const slug of readdirSync(visionDir)) {
      if (!completedFeatures.has(slug)) continue;

      const slugDir = join(visionDir, slug);
      const size = getDirSize(slugDir);

      // Keep baselines, remove screenshots and reports
      try {
        for (const file of readdirSync(slugDir)) {
          if (file === "baselines") continue; // Keep baselines
          const fullPath = join(slugDir, file);
          const fSize = getFileSize(fullPath);
          if (!dryRun) {
            if (statSync(fullPath).isDirectory()) {
              rmSync(fullPath, { recursive: true, force: true });
            } else {
              unlinkSync(fullPath);
            }
          }
          files++;
          bytes += fSize;
        }
      } catch { /* skip */ }

      if (files > 0) {
        console.log(`  vision   ${dryRun ? "(would clean)" : "cleaned"} ${slug}/ (${formatBytes(bytes)}, baselines kept)`);
      }
    }
  } catch { /* skip */ }

  if (files === 0) {
    console.log("  vision   nothing to clean");
  }

  return { files, bytes };
}

function cleanGeneratedReports(root, dryRun) {
  const reports = [
    ".ogu/DOCTOR.md",
    ".ogu/TRENDS.md",
    ".ogu/OBSERVATION_REPORT.md",
    ".ogu/MEMORY_PROPOSAL.md",
  ];

  let files = 0;
  let bytes = 0;

  for (const report of reports) {
    const fullPath = join(root, report);
    if (!existsSync(fullPath)) continue;

    const size = getFileSize(fullPath);
    console.log(`  report   ${dryRun ? "(would remove)" : "removed"} ${report} (${formatBytes(size)})`);
    if (!dryRun) unlinkSync(fullPath);
    files++;
    bytes += size;
  }

  if (files === 0) {
    console.log("  reports  nothing to clean");
  }

  return { files, bytes };
}

// ---------------------------------------------------------------------------

function getFileSize(path) {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function getDirSize(dir) {
  let size = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        size += getDirSize(full);
      } else {
        size += getFileSize(full);
      }
    }
  } catch { /* skip */ }
  return size;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}
