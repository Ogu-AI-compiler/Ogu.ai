/**
 * Finite Automaton — deterministic finite automaton (DFA).
 */
export function createDFA({ states, initial, accepting, transitions }) {
  let current = initial;

  function step(symbol) {
    const trans = transitions[current];
    if (trans && trans[symbol] !== undefined) {
      current = trans[symbol];
      return true;
    }
    return false;
  }

  function run(input) {
    current = initial;
    for (const ch of input) {
      if (!step(ch)) return false;
    }
    return true;
  }

  function accepts(input) {
    run(input);
    return accepting.includes(current);
  }

  function getState() { return current; }
  function reset() { current = initial; }

  return { step, run, accepts, getState, reset };
}
