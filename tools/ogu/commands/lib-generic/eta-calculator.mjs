/**
 * ETA Calculator — estimate time remaining based on velocity.
 */

/**
 * Format milliseconds as human-readable ETA.
 *
 * @param {number} ms
 * @returns {string}
 */
export function formatETA(ms) {
  if (ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}min ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
}

/**
 * Create an ETA calculator.
 *
 * @param {{ total: number }} opts
 * @returns {object} Calculator with recordProgress/getETA
 */
export function createETACalculator({ total }) {
  const samples = []; // { completed, timestamp }

  function recordProgress(completed, timestamp = Date.now()) {
    samples.push({ completed, timestamp });
  }

  function getETA() {
    if (samples.length < 2) {
      return { remainingMs: Infinity, velocity: 0, formatted: 'unknown' };
    }

    const first = samples[0];
    const last = samples[samples.length - 1];
    const elapsed = last.timestamp - first.timestamp;
    const progress = last.completed - first.completed;

    if (elapsed <= 0 || progress <= 0) {
      return { remainingMs: Infinity, velocity: 0, formatted: 'unknown' };
    }

    const velocity = (progress / elapsed) * 1000; // items per second
    const remaining = total - last.completed;
    const remainingMs = (remaining / velocity) * 1000;

    return {
      remainingMs,
      velocity,
      remaining,
      formatted: formatETA(remainingMs),
    };
  }

  return { recordProgress, getETA };
}
