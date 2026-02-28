/**
 * Prefix Matcher — match strings against registered prefixes.
 */
export function createPrefixMatcher() {
  const patterns = []; // sorted longest-first on match

  function addPattern(prefix, handler) {
    patterns.push({ prefix, handler });
    patterns.sort((a, b) => b.prefix.length - a.prefix.length);
  }

  function match(input) {
    for (const p of patterns) {
      if (input.startsWith(p.prefix)) return { prefix: p.prefix, handler: p.handler };
    }
    return null;
  }

  function matchAll(input) {
    return patterns
      .filter(p => input.startsWith(p.prefix))
      .map(p => ({ prefix: p.prefix, handler: p.handler }));
  }

  return { addPattern, match, matchAll };
}
