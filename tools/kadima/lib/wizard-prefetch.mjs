/**
 * wizard-prefetch.mjs — Predictive prefetch cache for wizard steps.
 *
 * After classify returns, the next steps (clarify + palette) are generated
 * in the background while the user reads the classify result (~5-10s human time).
 * When the user clicks Next, results are returned from cache — instant.
 *
 * Cache keys:
 *   clarify  → description + archetypeId + detailLevel  (first call has no answers)
 *   palette  → description + archetypeId                (answers don't affect colors much)
 *
 * TTL: 15 minutes — enough for any wizard session.
 */

const TTL_MS = 15 * 60 * 1000;
const store   = new Map();

// ── Cache primitives ──────────────────────────────────────────────────────────

function makeKey(step, ...parts) {
  return `${step}::${parts.map(String).join('::')}`;
}

export function cacheGet(step, ...keyParts) {
  const entry = store.get(makeKey(step, ...keyParts));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { store.delete(makeKey(step, ...keyParts)); return null; }
  return entry.value;
}

export function cacheSet(step, value, ...keyParts) {
  store.set(makeKey(step, ...keyParts), { value, expiresAt: Date.now() + TTL_MS });
}

// ── Prefetch trigger (fire-and-forget) ────────────────────────────────────────

/**
 * Called after classify responds.
 * Immediately starts generating clarify + palette in the background.
 *
 * @param {object} opts
 * @param {string} opts.description
 * @param {string} opts.archetypeId   — top archetype id from classify result
 * @param {string} opts.detailLevel   — from classify result
 * @param {Function} opts.generateClarify  — the clarify generator function
 * @param {Function} opts.generatePalette  — the palette generator function
 */
export function prefetchAfterClassify({ description, archetypeId, detailLevel, generateClarify, generatePalette }) {
  // Both run in parallel — don't await
  ;(async () => {
    try {
      const result = await generateClarify(description, archetypeId, detailLevel, {});
      cacheSet('clarify', result, description, archetypeId, detailLevel);
    } catch { /* best-effort — user will get a fresh call if this fails */ }
  })();

  ;(async () => {
    try {
      const result = await generatePalette(description, archetypeId);
      cacheSet('palette', result, description, archetypeId);
    } catch { /* best-effort */ }
  })();
}
