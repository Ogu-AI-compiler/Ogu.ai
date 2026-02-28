/**
 * Jitter Calculator — add controlled randomization to intervals.
 */

/**
 * Add ±percentage jitter to a base value.
 * @param {number} base
 * @param {number} jitterPct - fraction (0 to 1), e.g. 0.25 = ±25%
 * @returns {number}
 */
export function addJitter(base, jitterPct) {
  if (jitterPct === 0) return base;
  const range = base * jitterPct;
  return base + (Math.random() * 2 - 1) * range;
}

/**
 * Full jitter: return random value between 0 and max.
 * @param {number} max
 * @returns {number}
 */
export function fullJitter(max) {
  return Math.random() * max;
}

/**
 * Decorrelated jitter: next = random between baseMs and prevMs * 3.
 * @param {{ baseMs: number, prevMs: number }} opts
 * @returns {number}
 */
export function decorrelatedJitter({ baseMs, prevMs }) {
  return baseMs + Math.random() * (prevMs * 3 - baseMs);
}
