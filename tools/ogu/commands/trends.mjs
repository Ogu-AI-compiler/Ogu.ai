import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";

export async function trends() {
  const root = repoRoot();
  const featuresDir = join(root, "docs/vault/04_Features");

  if (!existsSync(featuresDir)) {
    console.log("  No features directory found.");
    console.log("  Run /feature to create features first.");
    return 0;
  }

  const features = collectFeatureData(root, featuresDir);

  if (features.length === 0) {
    console.log("  No features with metrics found.");
    console.log("  Complete features with /done to generate metrics.");
    return 0;
  }

  // Aggregate gate failure rates
  const gateStats = aggregateGateStats(features);

  // Completion time analysis
  const completionStats = aggregateCompletionStats(features);

  // Production issue rate
  const prodStats = aggregateProductionStats(features);

  // Trend direction: first half vs second half
  const trendDirection = computeTrendDirection(features);

  // Build report
  const report = buildTrendsReport(features, gateStats, completionStats, prodStats, trendDirection);
  const reportPath = join(root, ".ogu/TRENDS.md");
  writeFileSync(reportPath, report, "utf-8");

  // Console summary
  console.log(`  features ${features.length} analyzed`);
  console.log(`  gates    ${Object.keys(gateStats).length} tracked`);

  if (Object.keys(gateStats).length > 0) {
    const worstGate = Object.entries(gateStats).sort((a, b) => b[1].failRate - a[1].failRate)[0];
    if (worstGate[1].failRate > 0) {
      console.log(`  worst    gate "${worstGate[0]}" (${(worstGate[1].failRate * 100).toFixed(0)}% failure rate)`);
    }
  }

  if (prodStats.totalIssues > 0) {
    console.log(`  prod     ${prodStats.totalIssues} issue(s) across ${prodStats.featuresWithIssues} feature(s)`);
  } else {
    console.log(`  prod     clean — no production issues`);
  }

  console.log(`  trend    ${trendDirection.overall}`);
  console.log(`  report   .ogu/TRENDS.md`);

  return 0;
}

// ---------------------------------------------------------------------------

function collectFeatureData(root, featuresDir) {
  const features = [];

  try {
    for (const slug of readdirSync(featuresDir)) {
      if (slug === "README.md") continue;
      const featureDir = join(featuresDir, slug);

      // Try feature-level METRICS.json
      const metricsPath = join(featureDir, "METRICS.json");
      const metrics = readJsonSafe(metricsPath);

      // Also check global METRICS.json
      const globalMetrics = readJsonSafe(join(root, ".ogu/METRICS.json"));
      const globalFeatureMetrics = globalMetrics?.features?.[slug];

      const plan = readJsonSafe(join(featureDir, "Plan.json"));

      if (metrics || globalFeatureMetrics) {
        features.push({
          slug,
          metrics: metrics || {},
          globalMetrics: globalFeatureMetrics || {},
          plan,
          taskCount: plan?.tasks?.length || 0,
        });
      }
    }
  } catch { /* skip */ }

  // Sort by completion time (earliest first)
  features.sort((a, b) => {
    const aTime = a.globalMetrics?.completed_at || a.metrics?.completed_at || "";
    const bTime = b.globalMetrics?.completed_at || b.metrics?.completed_at || "";
    return aTime.localeCompare(bTime);
  });

  return features;
}

function aggregateGateStats(features) {
  const stats = {};

  for (const feature of features) {
    const gateResults = feature.globalMetrics?.gate_results || feature.metrics?.gate_results || {};

    for (const [gate, result] of Object.entries(gateResults)) {
      if (!stats[gate]) {
        stats[gate] = { total: 0, failed: 0, totalAttempts: 0, failRate: 0 };
      }
      stats[gate].total++;
      stats[gate].totalAttempts += result.attempts || 1;
      if ((result.attempts || 1) > 1) {
        stats[gate].failed++;
      }
    }
  }

  // Compute failure rates
  for (const gate of Object.values(stats)) {
    gate.failRate = gate.total > 0 ? gate.failed / gate.total : 0;
    gate.avgAttempts = gate.total > 0 ? gate.totalAttempts / gate.total : 0;
  }

  return stats;
}

function aggregateCompletionStats(features) {
  const times = [];

  for (const feature of features) {
    const started = feature.globalMetrics?.started_at || feature.metrics?.started_at;
    const completed = feature.globalMetrics?.completed_at || feature.metrics?.completed_at;

    if (started && completed) {
      const durationMs = new Date(completed) - new Date(started);
      const durationHours = durationMs / (1000 * 60 * 60);
      times.push({
        slug: feature.slug,
        hours: durationHours,
        tasks: feature.taskCount,
      });
    }
  }

  if (times.length === 0) {
    return { avg: null, min: null, max: null, count: 0, perTask: null };
  }

  const hours = times.map((t) => t.hours);
  return {
    avg: hours.reduce((a, b) => a + b, 0) / hours.length,
    min: Math.min(...hours),
    max: Math.max(...hours),
    count: times.length,
    perTask: times.filter((t) => t.tasks > 0).length > 0
      ? times.filter((t) => t.tasks > 0).reduce((a, t) => a + t.hours / t.tasks, 0) / times.filter((t) => t.tasks > 0).length
      : null,
    details: times,
  };
}

function aggregateProductionStats(features) {
  let totalIssues = 0;
  let featuresWithIssues = 0;
  const bySeverity = {};

  for (const feature of features) {
    const issues = feature.metrics?.production_issues || [];
    if (issues.length > 0) {
      featuresWithIssues++;
      totalIssues += issues.length;
      for (const issue of issues) {
        const sev = issue.severity || "unknown";
        bySeverity[sev] = (bySeverity[sev] || 0) + 1;
      }
    }
  }

  return {
    totalIssues,
    featuresWithIssues,
    issueRate: features.length > 0 ? featuresWithIssues / features.length : 0,
    bySeverity,
  };
}

function computeTrendDirection(features) {
  if (features.length < 2) {
    return { overall: "insufficient data", gateImprovement: null, speedImprovement: null };
  }

  const mid = Math.floor(features.length / 2);
  const firstHalf = features.slice(0, mid);
  const secondHalf = features.slice(mid);

  // Gate failure trend
  const firstGateFailures = countGateFailures(firstHalf);
  const secondGateFailures = countGateFailures(secondHalf);

  let gateImprovement = "stable";
  if (firstGateFailures > 0 && secondGateFailures < firstGateFailures) {
    gateImprovement = "improving";
  } else if (secondGateFailures > firstGateFailures) {
    gateImprovement = "degrading";
  }

  // Speed trend
  const firstAvg = avgCompletionTime(firstHalf);
  const secondAvg = avgCompletionTime(secondHalf);

  let speedImprovement = "stable";
  if (firstAvg && secondAvg) {
    if (secondAvg < firstAvg * 0.8) speedImprovement = "improving";
    else if (secondAvg > firstAvg * 1.2) speedImprovement = "degrading";
  }

  // Production issue trend
  const firstProd = countProductionIssues(firstHalf);
  const secondProd = countProductionIssues(secondHalf);

  let prodImprovement = "stable";
  if (firstProd > 0 && secondProd < firstProd) prodImprovement = "improving";
  else if (secondProd > firstProd) prodImprovement = "degrading";

  // Overall
  const scores = { improving: 1, stable: 0, degrading: -1 };
  const total = scores[gateImprovement] + scores[speedImprovement] + scores[prodImprovement];
  const overall = total > 0 ? "improving" : total < 0 ? "degrading" : "stable";

  return { overall, gateImprovement, speedImprovement, prodImprovement };
}

function countGateFailures(features) {
  let count = 0;
  for (const f of features) {
    const gates = f.globalMetrics?.gate_results || f.metrics?.gate_results || {};
    for (const result of Object.values(gates)) {
      if ((result.attempts || 1) > 1) count++;
    }
  }
  return count;
}

function avgCompletionTime(features) {
  const times = [];
  for (const f of features) {
    const started = f.globalMetrics?.started_at || f.metrics?.started_at;
    const completed = f.globalMetrics?.completed_at || f.metrics?.completed_at;
    if (started && completed) {
      times.push((new Date(completed) - new Date(started)) / (1000 * 60 * 60));
    }
  }
  return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null;
}

function countProductionIssues(features) {
  let count = 0;
  for (const f of features) {
    count += (f.metrics?.production_issues || []).length;
  }
  return count;
}

// ---------------------------------------------------------------------------

function buildTrendsReport(features, gateStats, completionStats, prodStats, trendDirection) {
  const now = new Date().toISOString();
  let md = `# Trends Report\n\nBuilt: ${now}\n\n`;

  // Summary
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Features analyzed | ${features.length} |\n`;
  md += `| Overall trend | **${trendDirection.overall}** |\n`;
  md += `| Gate quality | ${trendDirection.gateImprovement || "N/A"} |\n`;
  md += `| Speed | ${trendDirection.speedImprovement || "N/A"} |\n`;
  md += `| Production stability | ${trendDirection.prodImprovement || "N/A"} |\n`;

  // Gate failure rates
  md += `\n## Gate Failure Rates\n\n`;
  const gateEntries = Object.entries(gateStats).sort((a, b) => b[1].failRate - a[1].failRate);

  if (gateEntries.length > 0) {
    md += `| Gate | Runs | Failures | Failure Rate | Avg Attempts |\n`;
    md += `|------|------|----------|--------------|--------------|\n`;
    for (const [gate, stats] of gateEntries) {
      const rate = (stats.failRate * 100).toFixed(0);
      md += `| ${gate} | ${stats.total} | ${stats.failed} | ${rate}% | ${stats.avgAttempts.toFixed(1)} |\n`;
    }
  } else {
    md += `No gate data available.\n`;
  }

  // Completion times
  md += `\n## Completion Times\n\n`;
  if (completionStats.count > 0) {
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Features timed | ${completionStats.count} |\n`;
    md += `| Average | ${completionStats.avg.toFixed(1)}h |\n`;
    md += `| Fastest | ${completionStats.min.toFixed(1)}h |\n`;
    md += `| Slowest | ${completionStats.max.toFixed(1)}h |\n`;
    if (completionStats.perTask) {
      md += `| Avg per task | ${completionStats.perTask.toFixed(1)}h |\n`;
    }

    if (completionStats.details?.length > 0) {
      md += `\n### Per Feature\n\n`;
      md += `| Feature | Hours | Tasks |\n|---------|-------|-------|\n`;
      for (const d of completionStats.details) {
        md += `| ${d.slug} | ${d.hours.toFixed(1)} | ${d.tasks} |\n`;
      }
    }
  } else {
    md += `No completion time data available.\n`;
  }

  // Production issues
  md += `\n## Production Issues\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total issues | ${prodStats.totalIssues} |\n`;
  md += `| Features affected | ${prodStats.featuresWithIssues}/${features.length} |\n`;
  md += `| Issue rate | ${(prodStats.issueRate * 100).toFixed(0)}% |\n`;

  if (Object.keys(prodStats.bySeverity).length > 0) {
    md += `\n### By Severity\n\n`;
    for (const [sev, count] of Object.entries(prodStats.bySeverity)) {
      md += `- **${sev}**: ${count}\n`;
    }
  }

  // Feature-by-feature
  md += `\n## Features\n\n`;
  md += `| # | Feature | Tasks | Gate Failures | Prod Issues |\n`;
  md += `|---|---------|-------|---------------|-------------|\n`;

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const gates = f.globalMetrics?.gate_results || f.metrics?.gate_results || {};
    const gateFailCount = Object.values(gates).filter((r) => (r.attempts || 1) > 1).length;
    const prodIssueCount = (f.metrics?.production_issues || []).length;
    md += `| ${i + 1} | ${f.slug} | ${f.taskCount} | ${gateFailCount} | ${prodIssueCount} |\n`;
  }

  return md;
}
