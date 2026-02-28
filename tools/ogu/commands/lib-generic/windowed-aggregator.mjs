/**
 * Windowed Aggregator — count-window aggregations over streams.
 */

/**
 * @param {{ windowSize: number }} opts
 */
export function createWindowedAggregator({ windowSize }) {
  const window = [];

  function add(value) {
    window.push(value);
    if (window.length > windowSize) {
      window.shift();
    }
  }

  function aggregate(op) {
    if (window.length === 0) return 0;

    switch (op) {
      case "sum":
        return window.reduce((a, b) => a + b, 0);
      case "avg":
        return window.reduce((a, b) => a + b, 0) / window.length;
      case "count":
        return window.length;
      case "min":
        return Math.min(...window);
      case "max":
        return Math.max(...window);
      default:
        throw new Error(`Unknown aggregation: ${op}`);
    }
  }

  function getWindow() {
    return [...window];
  }

  return { add, aggregate, getWindow };
}
