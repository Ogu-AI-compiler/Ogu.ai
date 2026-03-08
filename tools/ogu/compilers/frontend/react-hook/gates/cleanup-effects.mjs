/**
 * Gate: cleanup-effects
 * Every useEffect that sets up a subscription, timer, or event listener
 * must return a cleanup function.
 *
 * Patterns that require cleanup:
 * - setTimeout / setInterval
 * - addEventListener
 * - subscribe / on() / addListener
 * - WebSocket / EventSource
 * - IntersectionObserver / ResizeObserver / MutationObserver
 * - AbortController (fetch)
 */
import { readFileSync, existsSync, readdirSync } from "fs";

const NEEDS_CLEANUP = [
  /\bsetTimeout\s*\(/,
  /\bsetInterval\s*\(/,
  /\.addEventListener\s*\(/,
  /\.subscribe\s*\(/,
  /\.on\s*\(/,
  /\.addListener\s*\(/,
  /new\s+WebSocket\s*\(/,
  /new\s+EventSource\s*\(/,
  /new\s+IntersectionObserver\s*\(/,
  /new\s+ResizeObserver\s*\(/,
  /new\s+MutationObserver\s*\(/,
  /new\s+AbortController\s*\(/,
];

const HAS_CLEANUP = /\breturn\s*(?:\(\s*\)|\w+\s*=>\s*|\bfunction\b)/;

function extractEffectBodies(content) {
  const bodies = [];
  let i = 0;

  while (i < content.length) {
    const idx = content.indexOf("useEffect(", i);
    if (idx === -1) break;

    // Find the callback body — scan for the opening { after useEffect(
    let start = idx + "useEffect(".length;
    // Skip to opening brace of callback
    while (start < content.length && content[start] !== "{") start++;
    if (start >= content.length) { i = idx + 1; continue; }

    // Scan for matching close brace
    let depth = 1;
    let j = start + 1;
    while (j < content.length && depth > 0) {
      if (content[j] === "{") depth++;
      else if (content[j] === "}") depth--;
      j++;
    }

    bodies.push({ start: idx, body: content.slice(start, j) });
    i = j;
  }

  return bodies;
}

export async function run({ dir }) {
  const hookFiles = existsSync(dir)
    ? readdirSync(dir).filter(f => /^use[A-Z].+\.(ts|tsx)$/.test(f) && !f.includes(".test."))
    : [];

  if (hookFiles.length === 0) {
    return { pass: false, code: "RH006", message: "No hook file found" };
  }

  const violations = [];

  for (const file of hookFiles) {
    const content = readFileSync(`${dir}/${file}`, "utf8");
    const effects = extractEffectBodies(content);

    for (const effect of effects) {
      const needsCleanup = NEEDS_CLEANUP.some(re => re.test(effect.body));
      if (!needsCleanup) continue;

      const hasCleanup = HAS_CLEANUP.test(effect.body);
      if (!hasCleanup) {
        const lineNum = content.slice(0, effect.start).split("\n").length;
        const pattern = NEEDS_CLEANUP.find(re => re.test(effect.body));
        violations.push({
          file,
          line: lineNum,
          pattern: pattern?.toString().replace(/[/\\^$.*+?()[\]{}|]/g, "").slice(2, 20),
          hint: "Return a cleanup function: return () => { clearTimeout(id) / removeEventListener(...) / subscription.unsubscribe() }",
        });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false,
      code: "RH006",
      message: `${violations.length} useEffect(s) with side effects missing cleanup return`,
      detail: { violations },
    };
  }

  return { pass: true, detail: { effectsChecked: hookFiles.length } };
}
