/**
 * Feature Scaler — min-max and standard scaling.
 */
export function minMaxScale(arr) {
  const min = Math.min(...arr), max = Math.max(...arr);
  const range = max - min || 1;
  return arr.map(v => (v - min) / range);
}

export function standardScale(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length) || 1;
  return arr.map(v => (v - mean) / std);
}
