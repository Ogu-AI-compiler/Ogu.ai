/**
 * Trend Analysis Engine — org-level trend analysis and anomaly detection.
 *
 * Tracks metrics over time, computes trend direction, and detects outliers
 * using standard deviation.
 */

/**
 * Create a trend engine.
 *
 * @returns {object} Engine with addDataPoint/getTrend/detectAnomalies
 */
export function createTrendEngine() {
  const metrics = new Map(); // metric → [{value, timestamp}]

  function addDataPoint({ metric, value, timestamp }) {
    if (!metrics.has(metric)) metrics.set(metric, []);
    metrics.get(metric).push({ value, timestamp });
  }

  function getTrend(metric) {
    const data = metrics.get(metric);
    if (!data || data.length === 0) {
      return { direction: 'unknown', dataPoints: 0 };
    }

    const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const values = sorted.map(d => d.value);
    const n = values.length;

    if (n < 2) {
      return { direction: 'unknown', dataPoints: n, latest: values[n - 1] };
    }

    // Simple linear trend: compare first half average to second half average
    const mid = Math.floor(n / 2);
    const firstHalf = values.slice(0, mid);
    const secondHalf = values.slice(mid);
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

    const threshold = 0.01 * Math.max(Math.abs(avgFirst), Math.abs(avgSecond), 1);
    let direction;
    if (avgSecond - avgFirst > threshold) direction = 'increasing';
    else if (avgFirst - avgSecond > threshold) direction = 'decreasing';
    else direction = 'stable';

    return {
      direction,
      dataPoints: n,
      latest: values[n - 1],
      avgFirst,
      avgSecond,
    };
  }

  function detectAnomalies(metric, { threshold = 2 } = {}) {
    const data = metrics.get(metric);
    if (!data || data.length < 3) return [];

    const values = data.map(d => d.value);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return [];

    return data
      .filter(d => Math.abs(d.value - mean) > threshold * stdDev)
      .map(d => ({
        ...d,
        deviation: (d.value - mean) / stdDev,
        mean,
        stdDev,
      }));
  }

  return { addDataPoint, getTrend, detectAnomalies };
}
