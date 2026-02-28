/**
 * Cellular Automaton — 1D cellular automaton with configurable rule.
 */
export function createCellularAutomaton(initialState, rule) {
  let state = [...initialState];
  let generation = 0;
  function step() {
    const next = new Array(state.length);
    for (let i = 0; i < state.length; i++) {
      const left = i > 0 ? state[i - 1] : 0;
      const center = state[i];
      const right = i < state.length - 1 ? state[i + 1] : 0;
      next[i] = rule(left, center, right);
    }
    state = next;
    generation++;
  }
  function getState() { return [...state]; }
  function getGeneration() { return generation; }
  return { step, getState, getGeneration };
}
