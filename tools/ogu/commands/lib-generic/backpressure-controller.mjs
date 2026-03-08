/**
 * Backpressure Controller — flow control when consumers can't keep up.
 */

/**
 * Create a backpressure controller.
 *
 * @param {{ highWaterMark: number }} opts
 * @returns {object} Controller with push/pull/shouldPause/getMetrics
 */
export function createBackpressure({ highWaterMark }) {
  const buffer = [];

  function push(item) {
    buffer.push(item);
  }

  function pull() {
    return buffer.shift() || null;
  }

  function shouldPause() {
    return buffer.length >= highWaterMark;
  }

  function getMetrics() {
    return {
      buffered: buffer.length,
      highWaterMark,
      pressure: highWaterMark > 0 ? buffer.length / highWaterMark : 0,
    };
  }

  return { push, pull, shouldPause, getMetrics };
}
