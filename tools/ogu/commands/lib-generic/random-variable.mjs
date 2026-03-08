/**
 * Random Variable — discrete random variable with expected value and variance.
 */
export function createRandomVariable(outcomes) {
  function expectedValue() {
    return outcomes.reduce((s, o) => s + o.value * o.prob, 0);
  }
  function variance() {
    const ev = expectedValue();
    return outcomes.reduce((s, o) => s + o.prob * (o.value - ev) ** 2, 0);
  }
  function standardDeviation() { return Math.sqrt(variance()); }
  return { expectedValue, variance, standardDeviation };
}
