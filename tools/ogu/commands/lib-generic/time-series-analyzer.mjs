/**
 * Time Series Analyzer — trend detection and analysis.
 */
export function createTimeSeriesAnalyzer() {
  const data = [];
  function addAll(values) { data.push(...values); }
  function trend() {
    if (data.length < 2) return 'flat';
    let ups = 0, downs = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i] > data[i-1]) ups++;
      else if (data[i] < data[i-1]) downs++;
    }
    if (ups > downs) return 'up';
    if (downs > ups) return 'down';
    return 'flat';
  }
  function mean() { return data.reduce((a,b) => a+b, 0) / data.length; }
  return { addAll, trend, mean };
}
