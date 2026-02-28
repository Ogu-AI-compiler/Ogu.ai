/**
 * File Pattern Engine — match files against registered patterns.
 */
import { match as globMatch } from "./glob-matcher.mjs";

export function createFilePatternEngine() {
  const patterns = [];

  function addPattern(pattern, label) {
    patterns.push({ pattern, label });
  }

  function test(filePath) {
    for (const p of patterns) {
      if (globMatch(p.pattern, filePath)) return p.label;
    }
    return null;
  }

  function testAll(filePath) {
    return patterns
      .filter(p => globMatch(p.pattern, filePath))
      .map(p => p.label);
  }

  return { addPattern, test, testAll };
}
