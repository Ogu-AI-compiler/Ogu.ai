/**
 * Lindenmayer Engine — stateful L-System with iteration tracking.
 */
export function createLSystem({ axiom, rules }) {
  let current = axiom;
  let generation = 0;

  function iterate(n = 1) {
    for (let i = 0; i < n; i++) {
      let next = "";
      for (const ch of current) {
        next += rules[ch] !== undefined ? rules[ch] : ch;
      }
      current = next;
      generation++;
    }
  }

  function getString() { return current; }
  function getGeneration() { return generation; }
  function reset() { current = axiom; generation = 0; }

  return { iterate, getString, getGeneration, reset };
}
