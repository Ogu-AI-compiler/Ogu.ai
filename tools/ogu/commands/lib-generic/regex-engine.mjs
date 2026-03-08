/**
 * Regex Engine — simple pattern matching engine.
 */
export function createRegexEngine() {
  function match(pattern, text) {
    const idx = text.indexOf(pattern);
    if (idx === -1) return null;
    return { index: idx, match: pattern };
  }

  function matchAll(pattern, text) {
    const results = [];
    let pos = 0;
    while (pos <= text.length - pattern.length) {
      const idx = text.indexOf(pattern, pos);
      if (idx === -1) break;
      results.push({ index: idx, match: pattern });
      pos = idx + 1;
    }
    return results;
  }

  function replace(pattern, replacement, text) {
    return text.split(pattern).join(replacement);
  }

  return { match, matchAll, replace };
}
