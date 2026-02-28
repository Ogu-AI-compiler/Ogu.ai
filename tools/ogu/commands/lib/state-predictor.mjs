/**
 * State Predictor — predict next state from observed sequences.
 */
export function createStatePredictor() {
  const transitions = new Map();
  let lastState = null;

  function observe(state) {
    if (lastState !== null) {
      if (!transitions.has(lastState)) transitions.set(lastState, new Map());
      const t = transitions.get(lastState);
      t.set(state, (t.get(state) || 0) + 1);
    }
    lastState = state;
  }

  function predict(state) {
    const t = transitions.get(state);
    if (!t) return null;
    let best = null, bestCount = 0;
    for (const [s, count] of t) {
      if (count > bestCount) { bestCount = count; best = s; }
    }
    return best;
  }

  function getConfidence(state) {
    const t = transitions.get(state);
    if (!t) return 0;
    const total = [...t.values()].reduce((a, b) => a + b, 0);
    const max = Math.max(...t.values());
    return max / total;
  }

  return { observe, predict, getConfidence };
}
