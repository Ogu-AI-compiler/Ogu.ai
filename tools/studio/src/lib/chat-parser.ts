/**
 * Chat parser — routes known commands directly, sends everything else to Claude.
 */

export interface ParsedCommand {
  command: string;
  args: string[];
  description: string;
}

export type ParseResult =
  | { type: "command"; data: ParsedCommand }
  | { type: "claude" };

/* ── Known CLI commands ── */

const knownCommands = new Set([
  "doctor", "context", "context:lock", "feature:create", "feature:validate",
  "gates", "preview", "profile", "graph", "impact", "adr",
  "contracts:validate", "contract:version", "contract:diff", "contract:migrate",
  "vision", "vision:baseline", "remember", "learn", "recall", "trends",
  "orchestrate", "wip", "switch", "status", "observe:setup", "observe",
  "theme", "init", "validate", "log", "repo-map", "clean", "migrate",
  "brand-scan", "reference",
]);

/* ── Direct command patterns (EN + HE) ── */

const patterns: { match: RegExp; build: (m: RegExpMatchArray) => ParsedCommand }[] = [
  { match: /^doctor$/i, build: () => ({ command: "doctor", args: [], description: "Running health check" }) },
  { match: /^validate$/i, build: () => ({ command: "validate", args: [], description: "Validating structure" }) },
  { match: /^status$/i, build: () => ({ command: "status", args: [], description: "Showing project status" }) },
  { match: /^(show\s+)?features?$/i, build: () => ({ command: "wip", args: [], description: "Showing features" }) },
  { match: /^wip$/i, build: () => ({ command: "wip", args: [], description: "Showing features" }) },
  { match: /^recall$/i, build: () => ({ command: "recall", args: [], description: "Querying patterns" }) },
  { match: /^trends$/i, build: () => ({ command: "trends", args: [], description: "Analyzing trends" }) },
  { match: /^clean$/i, build: () => ({ command: "clean", args: [], description: "Cleaning artifacts" }) },
  { match: /^profile$/i, build: () => ({ command: "profile", args: [], description: "Detecting profile" }) },
  { match: /^(show\s+)?presets$/i, build: () => ({ command: "theme", args: ["presets"], description: "Listing presets" }) },
  { match: /^(show\s+)?brands?$/i, build: () => ({ command: "brand-scan", args: ["list"], description: "Listing brand scans" }) },
  { match: /^(show\s+)?references?$/i, build: () => ({ command: "reference", args: ["show"], description: "Showing design reference" }) },
];

/* ── Main parser ── */

export function parseChat(input: string): ParseResult {
  const trimmed = input.trim();

  // Direct pattern match
  for (const { match, build } of patterns) {
    const m = trimmed.match(match);
    if (m) return { type: "command", data: build(m) };
  }

  // Raw CLI command (first word is a known command)
  const parts = trimmed.split(/\s+/);
  if (parts.length > 0 && knownCommands.has(parts[0])) {
    return {
      type: "command",
      data: {
        command: parts[0],
        args: parts.slice(1),
        description: `Running: ogu ${trimmed}`,
      },
    };
  }

  // Everything else → send to Claude
  return { type: "claude" };
}

/** Extract scannable URLs from user text (excludes localhost, bare IPs) */
export function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  return (text.match(re) || []).filter((url) => {
    try {
      const u = new URL(url);
      return u.hostname.includes(".") && !u.hostname.startsWith("127.") && u.hostname !== "localhost";
    } catch { return false; }
  });
}
