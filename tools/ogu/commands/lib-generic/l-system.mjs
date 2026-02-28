/**
 * L-System — string rewriting system for fractal generation.
 */
export function generate(axiom, rules, iterations) {
  let current = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = "";
    for (const ch of current) {
      next += rules[ch] !== undefined ? rules[ch] : ch;
    }
    current = next;
  }
  return current;
}
