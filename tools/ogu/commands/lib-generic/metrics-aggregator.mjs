/**
 * Metrics Aggregator — unified observability with health score computation.
 *
 * Records named metrics, computes summary statistics (min/max/avg/count),
 * and derives an overall health score from gate pass/fail ratios.
 */

/**
 * Create a metrics aggregator.
 *
 * @returns {object} Aggregator with record/getSummary/computeHealthScore
 */
export function createMetricsAggregator() {
  const metrics = new Map(); // name → [values]

  function record({ name, value }) {
    if (!metrics.has(name)) metrics.set(name, []);
    metrics.get(name).push(value);
  }

  function getSummary() {
    const summary = {};
    for (const [name, values] of metrics) {
      const count = values.length;
      const sum = values.reduce((s, v) => s + v, 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = sum / count;
      summary[name] = { count, sum, min, max, avg };
    }
    return summary;
  }

  function computeHealthScore() {
    const passValues = metrics.get('gate.pass') || [];
    const failValues = metrics.get('gate.fail') || [];
    const totalGates = passValues.length + failValues.length;

    if (totalGates === 0) return 100; // No gates = healthy by default

    const passRate = passValues.length / totalGates;
    return Math.round(passRate * 100);
  }

  return { record, getSummary, computeHealthScore };
}
