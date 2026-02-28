/**
 * Metric Collector — counters, gauges, histograms for system observability.
 */

export const METRIC_TYPES = ['counter', 'gauge', 'histogram'];

/**
 * Create a metric collector instance.
 * @returns {object} Collector with counter/gauge/histogram/getAll/reset
 */
export function createCollector() {
  const metrics = new Map();

  function counter(name, increment = 1) {
    const existing = metrics.get(name);
    if (existing && existing.type === 'counter') {
      existing.value += increment;
    } else {
      metrics.set(name, { type: 'counter', value: increment });
    }
  }

  function gauge(name, value) {
    metrics.set(name, { type: 'gauge', value });
  }

  function histogram(name, value) {
    const existing = metrics.get(name);
    if (existing && existing.type === 'histogram') {
      existing.samples.push(value);
      existing.count = existing.samples.length;
      existing.min = Math.min(existing.min, value);
      existing.max = Math.max(existing.max, value);
      existing.avg = existing.samples.reduce((a, b) => a + b, 0) / existing.count;
    } else {
      metrics.set(name, {
        type: 'histogram',
        samples: [value],
        count: 1,
        min: value,
        max: value,
        avg: value,
      });
    }
  }

  function getAll() {
    const result = {};
    for (const [name, data] of metrics) {
      result[name] = { ...data };
      if (data.samples) delete result[name].samples; // Don't expose raw samples
    }
    return result;
  }

  function reset() {
    metrics.clear();
  }

  return { counter, gauge, histogram, getAll, reset };
}
