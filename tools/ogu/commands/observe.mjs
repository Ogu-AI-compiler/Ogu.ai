import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";
import { repoRoot, readJsonSafe } from "../util.mjs";

export async function observe() {
  const args = process.argv.slice(3);
  const createTickets = args.includes("--create-tickets");
  const root = repoRoot();

  const configPath = join(root, ".ogu/OBSERVE.json");
  const config = readJsonSafe(configPath);

  if (!config || !config.sources || config.sources.length === 0) {
    console.error("  ERROR  No observation sources configured.");
    console.error("  Run: ogu observe:setup --add <sentry|uptime|...>");
    return 1;
  }

  const enabledSources = config.sources.filter((s) => s.enabled);
  if (enabledSources.length === 0) {
    console.error("  ERROR  All observation sources are disabled.");
    return 1;
  }

  console.log(`  Observing ${enabledSources.length} source(s)...\n`);

  const allEvents = [];
  const sourceResults = [];

  for (const source of enabledSources) {
    try {
      const result = await observeSource(source);
      sourceResults.push({ source: source.type, ...result });
      allEvents.push(...(result.events || []));
      console.log(`  ${source.type.padEnd(12)} ${result.status} (${result.events?.length || 0} events)`);
    } catch (err) {
      sourceResults.push({ source: source.type, status: "ERROR", error: err.message });
      console.log(`  ${source.type.padEnd(12)} ERROR: ${err.message}`);
    }
  }

  // Deduplicate against known issues
  const newEvents = deduplicateEvents(allEvents, config.known_issues || []);

  // Correlate with releases
  const correlated = correlateWithReleases(newEvents, config.releases || []);

  // Classify by ownership (using GRAPH.json if available)
  const classified = classifyOwnership(correlated, root);

  // Write production issues to feature METRICS.json (observe → learn connection)
  writeProductionIssues(root, classified);

  // Update config
  config.last_observation = new Date().toISOString();
  config.events = (config.events || []).concat(newEvents).slice(-50); // Keep last 50

  // Write config
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  // Generate report
  const report = buildObservationReport(sourceResults, classified, config);
  const reportPath = join(root, ".ogu/OBSERVATION_REPORT.md");
  writeFileSync(reportPath, report, "utf-8");

  // Create tickets if requested
  if (createTickets) {
    const created = await createTicketsFromEvents(root, classified, config);
    if (created > 0) {
      console.log(`\n  tickets  ${created} feature ticket(s) created`);
    }
  }

  // Summary
  console.log("");
  console.log(`  events   ${allEvents.length} total, ${newEvents.length} new`);
  console.log(`  report   .ogu/OBSERVATION_REPORT.md`);

  const highSeverity = classified.filter((e) => e.severity === "error" || e.severity === "critical");
  if (highSeverity.length > 0) {
    console.log(`  ACTION   ${highSeverity.length} high-severity event(s) need attention`);
  }

  return highSeverity.length > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------

async function observeSource(source) {
  switch (source.type) {
    case "uptime":
      return observeUptime(source);
    case "sentry":
      return observeSentry(source);
    case "analytics":
      return observeAnalytics(source);
    case "custom":
      return observeCustom(source);
    default:
      return { status: "UNKNOWN", events: [] };
  }
}

async function observeUptime(source) {
  try {
    const resp = await fetch(source.endpoint, {
      signal: AbortSignal.timeout(5000),
    });
    const status = resp.ok ? "UP" : "DOWN";
    const events = [];

    if (!resp.ok) {
      events.push({
        id: `uptime-${Date.now()}`,
        source: "uptime",
        severity: "error",
        title: `Health check failed: ${source.endpoint} (${resp.status})`,
        count: 1,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        url: source.endpoint,
      });
    }

    return { status, response_ms: null, events };
  } catch (err) {
    return {
      status: "UNREACHABLE",
      events: [{
        id: `uptime-${Date.now()}`,
        source: "uptime",
        severity: "critical",
        title: `Endpoint unreachable: ${source.endpoint} (${err.message})`,
        count: 1,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        url: source.endpoint,
      }],
    };
  }
}

async function observeSentry(source) {
  const token = process.env[source.api_token_env];
  if (!token) {
    return { status: "NO_TOKEN", events: [], error: `Set ${source.api_token_env} env var` };
  }

  try {
    const url = `https://sentry.io/api/0/projects/${source.org_slug}/${source.project_slug}/issues/?query=is:unresolved&limit=10`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return { status: `HTTP_${resp.status}`, events: [] };
    }

    const issues = await resp.json();
    const events = issues.map((issue) => ({
      id: `sentry-${issue.id}`,
      source: "sentry",
      severity: mapSentrySeverity(issue.level),
      title: issue.title,
      count: issue.count || 1,
      first_seen: issue.firstSeen,
      last_seen: issue.lastSeen,
      affected_users: issue.userCount || 0,
      url: issue.permalink,
    }));

    return { status: "OK", events };
  } catch (err) {
    return { status: "ERROR", events: [], error: err.message };
  }
}

async function observeAnalytics(source) {
  const token = process.env[source.api_token_env];
  if (!token) {
    return { status: "NO_TOKEN", events: [] };
  }

  try {
    const resp = await fetch(source.endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return { status: `HTTP_${resp.status}`, events: [] };
    }

    // Analytics doesn't produce events per se — just metrics
    return { status: "OK", events: [], data: await resp.json() };
  } catch (err) {
    return { status: "ERROR", events: [], error: err.message };
  }
}

async function observeCustom(source) {
  const token = process.env[source.api_token_env];
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const resp = await fetch(source.endpoint, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return { status: `HTTP_${resp.status}`, events: [] };
    }

    const data = await resp.json();
    // Normalize custom events
    const events = Array.isArray(data)
      ? data.map((item, i) => ({
          id: `custom-${Date.now()}-${i}`,
          source: "custom",
          severity: item.severity || "info",
          title: item.title || item.message || JSON.stringify(item).slice(0, 100),
          count: item.count || 1,
          first_seen: item.first_seen || new Date().toISOString(),
          last_seen: item.last_seen || new Date().toISOString(),
          url: source.endpoint,
        }))
      : [];

    return { status: "OK", events };
  } catch (err) {
    return { status: "ERROR", events: [], error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Observe → Learn connection
// ---------------------------------------------------------------------------

function writeProductionIssues(root, events) {
  const featureIssues = new Map();

  for (const event of events) {
    if (!event.release?.feature) continue;
    const feature = event.release.feature;
    if (!featureIssues.has(feature)) featureIssues.set(feature, []);
    featureIssues.get(feature).push({
      id: event.id,
      title: event.title,
      severity: event.severity,
      first_seen: event.first_seen,
      source: event.source,
      correlated_at: new Date().toISOString(),
    });
  }

  for (const [feature, issues] of featureIssues) {
    const metricsPath = join(root, `docs/vault/04_Features/${feature}/METRICS.json`);
    const metrics = readJsonSafe(metricsPath) || {};
    metrics.production_issues = metrics.production_issues || [];

    let added = 0;
    for (const issue of issues) {
      // Dedup by event id
      if (!metrics.production_issues.find((pi) => pi.id === issue.id)) {
        metrics.production_issues.push(issue);
        added++;
      }
    }

    if (added > 0) {
      writeFileSync(metricsPath, JSON.stringify(metrics, null, 2) + "\n", "utf-8");
      console.log(`  metrics  ${added} production issue(s) → ${feature}/METRICS.json`);
    }
  }
}

// ---------------------------------------------------------------------------

function deduplicateEvents(events, knownIssues) {
  const known = new Set(knownIssues.map((ki) => ki.class));
  return events.filter((e) => {
    const eventClass = normalizeEventClass(e);
    // New class or high count on existing class
    if (known.has(eventClass)) {
      return e.count > 100; // Only surface if exceeds threshold
    }
    return true;
  });
}

function normalizeEventClass(event) {
  // Normalize error into a class string for dedup
  const title = event.title || "";
  // Strip variable parts (line numbers, specific values)
  return title
    .replace(/\d+/g, "N")
    .replace(/'[^']*'/g, "'...'")
    .replace(/"[^"]*"/g, '"..."')
    .slice(0, 80);
}

function correlateWithReleases(events, releases) {
  if (releases.length === 0) return events.map((e) => ({ ...e, release: null }));

  const latestRelease = releases[releases.length - 1];
  return events.map((e) => {
    let correlatedRelease = null;
    // Check if event started after a release
    for (const rel of [...releases].reverse()) {
      if (e.first_seen && new Date(e.first_seen) >= new Date(rel.deployed_at)) {
        correlatedRelease = rel;
        break;
      }
    }
    return { ...e, release: correlatedRelease };
  });
}

function classifyOwnership(events, root) {
  const graph = readJsonSafe(join(root, ".ogu/GRAPH.json"));
  return events.map((e) => {
    // Try to extract file path from error title/stack
    const fileMatch = e.title?.match(/(?:at\s+|in\s+)([\w/.-]+\.[jt]sx?)/);
    let owner = "unassigned";

    if (fileMatch && graph?.reverse) {
      const file = fileMatch[1];
      owner = file.split("/").slice(0, 2).join("/") || "root";
    }

    return { ...e, owner };
  });
}

async function createTicketsFromEvents(root, events, config) {
  let created = 0;
  const highEvents = events.filter((e) => e.severity === "error" || e.severity === "critical");

  for (const event of highEvents) {
    const slug = `fix-${normalizeEventClass(event).slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

    // Check dedup: don't create if known
    const alreadyKnown = (config.known_issues || []).find((ki) => ki.ticket === slug);
    if (alreadyKnown) continue;

    // Create feature directory
    const featureDir = join(root, `docs/vault/04_Features/${slug}`);
    if (existsSync(featureDir)) continue;

    try {
      // Actually create the feature directory and pre-fill PRD
      const { mkdirSync } = await import("node:fs");
      mkdirSync(featureDir, { recursive: true });

      // Write pre-filled PRD
      const prd = `# ${slug} — Product Requirements

## Problem

Production issue detected by observation system:
- **Title:** ${event.title || "Unknown"}
- **Severity:** ${event.severity || "unknown"}
- **Source:** ${event.source || "unknown"}
- **First seen:** ${event.first_seen || "unknown"}
- **Affected users:** ${event.affected_users || "unknown"}
${event.url ? `- **Link:** ${event.url}` : ""}

## Users

All users affected by this production issue.

## Requirements

- [ ] Identify root cause of: ${event.title?.slice(0, 100) || "the issue"}
- [ ] Implement fix
- [ ] Verify fix resolves the issue
- [ ] Ensure no regression in related functionality

## Out of Scope

- Unrelated improvements to the affected module
`;
      writeFileSync(join(featureDir, "PRD.md"), prd, "utf-8");

      // Write minimal Spec skeleton
      const spec = `# ${slug} — Technical Spec

## Overview

Fix for production issue: ${event.title?.slice(0, 100) || "unknown"}

## Screens and Interactions

N/A — this is a bug fix, not a new feature.

## Edge Cases

- What if the fix introduces a regression?
- What if the root cause is in a shared module?

## Data Model
<!-- TO BE FILLED BY /architect -->

## API
<!-- TO BE FILLED BY /architect -->

## Mock API
<!-- TO BE FILLED BY /architect -->

## UI Components
<!-- TO BE FILLED BY /architect -->
`;
      writeFileSync(join(featureDir, "Spec.md"), spec, "utf-8");

      // Write QA.md
      const qa = `# ${slug} — QA Checklist

## Happy Path

- [ ] Original issue no longer occurs
- [ ] Fix verified in preview environment

## Edge Cases

- [ ] Related functionality still works
- [ ] No new errors in observation sources

## Regression

- [ ] All existing tests still pass
`;
      writeFileSync(join(featureDir, "QA.md"), qa, "utf-8");

      // Track in known issues
      config.known_issues = config.known_issues || [];
      config.known_issues.push({
        class: normalizeEventClass(event),
        first_seen: event.first_seen,
        ticket: slug,
      });

      // Update Index.md
      updateIndex(root, slug, `Fix: ${event.title?.slice(0, 60) || slug}`);

      console.log(`  ticket   ${slug} (created with PRD, Spec, QA)`);
      created++;
    } catch (err) {
      console.log(`  ticket   ${slug} — failed: ${err.message}`);
    }
  }

  return created;
}

// ---------------------------------------------------------------------------

function buildObservationReport(sourceResults, events, config) {
  const now = new Date().toISOString();
  let md = `# Observation Report\n\n`;
  md += `Built: ${now}\n\n`;

  // Sources
  md += `## Sources\n\n`;
  for (const sr of sourceResults) {
    md += `- **${sr.source}**: ${sr.status}`;
    if (sr.events?.length > 0) md += ` (${sr.events.length} events)`;
    if (sr.error) md += ` — ${sr.error}`;
    md += "\n";
  }

  // Events by severity
  const byOwner = {};
  for (const e of events) {
    const owner = e.owner || "unassigned";
    if (!byOwner[owner]) byOwner[owner] = [];
    byOwner[owner].push(e);
  }

  if (events.length > 0) {
    md += `\n## Events (${events.length})\n\n`;

    // Group by owner
    for (const [owner, ownerEvents] of Object.entries(byOwner)) {
      md += `### ${owner}\n\n`;
      for (const e of ownerEvents) {
        md += `- **[${e.severity?.toUpperCase()}]** ${e.title}\n`;
        if (e.count > 1) md += `  Count: ${e.count}`;
        if (e.affected_users) md += ` | Users: ${e.affected_users}`;
        if (e.count > 1 || e.affected_users) md += "\n";
        if (e.release) {
          md += `  Correlated release: ${e.release.git_sha?.slice(0, 8)} (${e.release.feature || "unknown"})\n`;
        }
        if (e.url) md += `  Link: ${e.url}\n`;
        md += "\n";
      }
    }
  } else {
    md += `\n## Events\n\nNo events found.\n`;
  }

  // Release correlation
  if (config.releases?.length > 0) {
    md += `\n## Releases\n\n`;
    for (const rel of config.releases.slice(-5)) {
      const eventCount = events.filter((e) => e.release?.git_sha === rel.git_sha).length;
      md += `- ${rel.git_sha.slice(0, 8)} at ${rel.deployed_at}`;
      if (rel.feature) md += ` (${rel.feature})`;
      md += ` — ${eventCount} correlated events\n`;
    }
  }

  // Suggested actions
  const highSeverity = events.filter((e) => e.severity === "error" || e.severity === "critical");
  if (highSeverity.length > 0) {
    md += `\n## Suggested Actions\n\n`;
    for (const e of highSeverity) {
      md += `- **[${e.severity?.toUpperCase()}]** ${e.title}\n`;
      md += `  → Suggested: create ticket or investigate\n\n`;
    }
  }

  return md;
}

function updateIndex(root, slug, title) {
  const indexPath = join(root, "docs/vault/04_Features/Index.md");
  if (!existsSync(indexPath)) {
    // Create Index.md if it doesn't exist
    const header = `# Features Index\n\n| Feature | Status | Created |\n|---------|--------|---------|\n`;
    writeFileSync(indexPath, header + `| [${slug}](./${slug}/) | new | ${new Date().toISOString().split("T")[0]} |\n`, "utf-8");
    return;
  }

  const content = readFileSync(indexPath, "utf-8");

  // Check if feature already listed
  if (content.includes(`[${slug}]`)) return;

  // Append row to table
  const row = `| [${slug}](./${slug}/) | new | ${new Date().toISOString().split("T")[0]} |\n`;
  writeFileSync(indexPath, content.trimEnd() + "\n" + row, "utf-8");
}

function mapSentrySeverity(level) {
  switch (level) {
    case "fatal": return "critical";
    case "error": return "error";
    case "warning": return "warning";
    default: return "info";
  }
}
