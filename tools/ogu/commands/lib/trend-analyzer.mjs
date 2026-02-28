/**
 * Trend Analyzer — detect trends from time-series data.
 */

/**
 * Detect trend direction from a data series.
 *
 * @param {number[]} data
 * @returns {{ direction: 'up' | 'down' | 'stable', slope: number }}
 */
export function detectTrend(data) {
  if (data.length < 2) return { direction: 'stable', slope: 0 };

  // Simple linear regression slope
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avgValue = sumY / n;
  const relSlope = avgValue !== 0 ? slope / avgValue : slope;

  if (relSlope > 0.05) return { direction: 'up', slope };
  if (relSlope < -0.05) return { direction: 'down', slope };
  return { direction: 'stable', slope };
}

/**
 * Compute moving average over a window.
 *
 * @param {number[]} data
 * @param {number} window
 * @returns {number[]}
 */
export function computeMovingAverage(data, window) {
  const result = [];
  for (let i = 0; i <= data.length - window; i++) {
    const slice = data.slice(i, i + window);
    const avg = slice.reduce((s, v) => s + v, 0) / window;
    result.push(avg);
  }
  return result;
}

/**
 * Detect anomalies using z-score method.
 *
 * @param {number[]} data
 * @param {number} threshold - z-score threshold (default 2)
 * @returns {Array<{ index: number, value: number, zscore: number }>}
 */
export function detectAnomalies(data, threshold = 2) {
  const mean = data.reduce((s, v) => s + v, 0) / data.length;
  const stddev = Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / data.length);
  if (stddev === 0) return [];

  return data
    .map((value, index) => ({ index, value, zscore: Math.abs((value - mean) / stddev) }))
    .filter(d => d.zscore > threshold);
}
