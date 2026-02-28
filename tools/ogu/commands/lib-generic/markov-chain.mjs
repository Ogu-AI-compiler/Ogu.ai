/**
 * Markov Chain — first-order Markov chain with transition probabilities.
 */
export function createMarkovChain() {
  const transitions = new Map();

  function train(sequence) {
    for (let i = 0; i < sequence.length - 1; i++) {
      const from = sequence[i], to = sequence[i + 1];
      if (!transitions.has(from)) transitions.set(from, new Map());
      const t = transitions.get(from);
      t.set(to, (t.get(to) || 0) + 1);
    }
  }

  function predict(state) {
    const t = transitions.get(state);
    if (!t) return null;
    let best = null, bestCount = 0;
    for (const [to, count] of t) {
      if (count > bestCount) { bestCount = count; best = to; }
    }
    return best;
  }

  function getTransitions(state) {
    const t = transitions.get(state);
    if (!t) return {};
    const total = [...t.values()].reduce((a, b) => a + b, 0);
    const result = {};
    for (const [to, count] of t) result[to] = count / total;
    return result;
  }

  return { train, predict, getTransitions };
}
