/**
 * batch-processor.mjs — Collects items and processes them in batches.
 */
export function createBatchProcessor({ batchSize = 50, flushIntervalMs = 5000, onFlush } = {}) {
  let buffer = [], timer = null;

  const flush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);
    try { await onFlush?.(batch); } catch { /* best-effort */ }
  };

  const scheduleFlush = () => {
    if (!timer && flushIntervalMs > 0) {
      timer = setTimeout(async () => { timer = null; await flush(); }, flushIntervalMs);
      timer.unref?.();
    }
  };

  return {
    add(item) { buffer.push(item); scheduleFlush(); if (buffer.length >= batchSize) { clearTimeout(timer); timer = null; flush(); } },
    async flush() { await flush(); },
    size() { return buffer.length; },
    stop() { clearTimeout(timer); timer = null; return flush(); },
  };
}
