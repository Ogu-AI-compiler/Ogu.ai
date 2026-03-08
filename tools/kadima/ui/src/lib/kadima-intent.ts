/**
 * Kadima Intent Router — three-way routing for user input.
 *
 * User Input → resolveIntent() → "kadima" | "ogu" | "claude"
 *
 * Pattern-based, zero LLM cost. Checks Kadima patterns first,
 * then falls through to parseChat() for Ogu CLI, then Claude.
 */

import { parseChat, type ParseResult } from "./chat-parser";

export type IntentRoute = "kadima" | "ogu" | "claude";

export type KadimaAction =
  | "status"
  | "standup"
  | "budget"
  | "who-working"
  | "allocate"
  | "approve"
  | "deny"
  | "morning-brief"
  | "health"
  | "next-task";

export interface ResolvedIntent {
  route: IntentRoute;
  kadimaAction?: KadimaAction;
  kadimaArgs?: Record<string, string>;
  oguCommand?: ParseResult;
  raw: string;
  confidence: number;
}

/* ── Kadima Patterns ── */

interface KadimaPattern {
  match: RegExp;
  action: KadimaAction;
  extractArgs?: (m: RegExpMatchArray) => Record<string, string>;
}

const kadimaPatterns: KadimaPattern[] = [
  // Morning brief (EN + HE)
  { match: /^(morning\s*brief|good\s*morning|בוקר\s*טוב)$/i, action: "morning-brief" },

  // Status / health — question-form or "kadima"/"system" prefix
  { match: /^(kadima|system)\s+(status|health|state|מצב)$/i, action: "status" },
  { match: /^(what('?s| is)\s+(the\s+)?(status|state|health))\??$/i, action: "status" },
  { match: /^(מה\s+(ה)?מצב|מה\s+קורה|איך\s+(ה)?מערכת)\??$/i, action: "status" },
  { match: /^(how('?s| is)\s+(the\s+)?(system|kadima))\??$/i, action: "status" },

  // Standup
  { match: /^(kadima|system)\s+standup$/i, action: "standup" },
  { match: /^(give\s+me\s+(a\s+)?)?standup(\s+report)?\??$/i, action: "standup" },
  { match: /^(what('?s| is)\s+)?today('?s)?\s+standup\??$/i, action: "standup" },
  { match: /^(סטנדאפ|דו"?ח\s+יומי)$/i, action: "standup" },

  // Budget
  { match: /^(kadima|system)\s+budget$/i, action: "budget" },
  { match: /^(what('?s| is)\s+(the\s+)?budget|how\s+much\s+(money|budget|left))\??$/i, action: "budget" },
  { match: /^(כמה\s+(כסף|תקציב)|מה\s+(ה)?תקציב)\??$/i, action: "budget" },

  // Who's working
  { match: /^(kadima|system)\s+(who|agents?)$/i, action: "who-working" },
  { match: /^(who('?s| is)\s+(working|running|active))\??$/i, action: "who-working" },
  { match: /^(show\s+)?agents?\??$/i, action: "who-working" },
  { match: /^(מי\s+עובד|מי\s+פעיל|סוכנים)\??$/i, action: "who-working" },

  // Allocate task
  { match: /^(kadima\s+)?(allocate|assign|dispatch)\s+(.+)$/i, action: "allocate",
    extractArgs: (m) => ({ task: m[3] }) },

  // Approve / Deny governance
  { match: /^(kadima\s+)?(approve|אשר)\s+(.+)$/i, action: "approve",
    extractArgs: (m) => ({ taskId: m[3] }) },
  { match: /^(kadima\s+)?(deny|reject|דחה)\s+(.+)$/i, action: "deny",
    extractArgs: (m) => ({ taskId: m[3] }) },

  // Next task
  { match: /^(what('?s| is)\s+)?next(\s+task)?\??$/i, action: "next-task" },
  { match: /^(kadima|system)\s+next$/i, action: "next-task" },
  { match: /^(מה\s+הבא|משימה\s+הבאה)\??$/i, action: "next-task" },

  // Health check
  { match: /^(kadima|system)\s+(health|ping)$/i, action: "health" },
];

/* ── Main Router ── */

export function resolveIntent(input: string): ResolvedIntent {
  const raw = input.trim();

  // 1. Check Kadima patterns first
  for (const { match, action, extractArgs } of kadimaPatterns) {
    const m = raw.match(match);
    if (m) {
      return {
        route: "kadima",
        kadimaAction: action,
        kadimaArgs: extractArgs?.(m),
        raw,
        confidence: 0.95,
      };
    }
  }

  // 2. Fall through to Ogu CLI (parseChat)
  const parsed = parseChat(raw);
  if (parsed.type === "command") {
    return {
      route: "ogu",
      oguCommand: parsed,
      raw,
      confidence: 0.9,
    };
  }

  // 3. Everything else → Claude
  return {
    route: "claude",
    raw,
    confidence: 0.5,
  };
}
