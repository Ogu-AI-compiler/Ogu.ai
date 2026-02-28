/**
 * Histogram Builder — bin data into histogram.
 */
export function createHistogram(numBins) {
  const values = [];
  function addAll(data) { values.push(...data); }
  function getBins() {
    if (values.length === 0) return [];
    const min = Math.min(...values), max = Math.max(...values);
    const binWidth = (max - min) / numBins || 1;
    const bins = Array.from({ length: numBins }, (_, i) => ({
      lo: min + i * binWidth,
      hi: min + (i + 1) * binWidth,
      count: 0
    }));
    for (const v of values) {
      let idx = Math.floor((v - min) / binWidth);
      if (idx >= numBins) idx = numBins - 1;
      bins[idx].count++;
    }
    return bins;
  }
  function getCount() { return values.length; }
  return { addAll, getBins, getCount };
}
