/**
 * Token Classifier — classify tokens by type.
 */
export function createTokenClassifier() {
  const classifiers = new Map();
  function register(type, testFn) { classifiers.set(type, testFn); }
  function classify(token) {
    for (const [type, testFn] of classifiers) {
      if (testFn(token)) return type;
    }
    return 'unknown';
  }
  function classifyAll(tokens) { return tokens.map(t => ({ ...t, classification: classify(t) })); }
  function listTypes() { return [...classifiers.keys()]; }
  return { register, classify, classifyAll, listTypes };
}
