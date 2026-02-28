/**
 * Branch Predictor — 2-bit saturating counter predictor.
 */
export function createBranchPredictor() {
  const counters = new Map();
  let correct = 0, total = 0;
  function predict(branch) {
    const c = counters.get(branch) || 1;
    return c >= 2;
  }
  function update(branch, taken) {
    const predicted = predict(branch);
    total++;
    if (predicted === taken) correct++;
    let c = counters.get(branch) || 1;
    if (taken) c = Math.min(3, c + 1);
    else c = Math.max(0, c - 1);
    counters.set(branch, c);
  }
  function getStats() { return { accuracy: total > 0 ? correct / total : 0, total, correct }; }
  return { predict, update, getStats };
}
