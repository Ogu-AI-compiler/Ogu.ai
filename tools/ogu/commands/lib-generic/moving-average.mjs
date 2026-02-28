/**
 * Moving Average — SMA and EMA.
 */
export function simpleMovingAverage(data, window) {
  const result = [];
  for (let i = window - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += data[j];
    result.push(sum / window);
  }
  return result;
}

export function exponentialMovingAverage(data, alpha) {
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i-1]);
  }
  return result;
}
