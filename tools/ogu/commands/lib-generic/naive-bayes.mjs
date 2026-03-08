/**
 * Naive Bayes — simple naive Bayes classifier.
 */
export function createNaiveBayes() {
  const cats = new Map();
  let total = 0;

  function learn(category, features) {
    if (!cats.has(category)) cats.set(category, { count: 0, features: new Map() });
    const c = cats.get(category);
    c.count++;
    total++;
    for (const f of features) c.features.set(f, (c.features.get(f) || 0) + 1);
  }

  function predict(features) {
    let best = null, bestScore = -Infinity;
    for (const [name, c] of cats) {
      let score = Math.log(c.count / total);
      const totalF = [...c.features.values()].reduce((a, b) => a + b, 0);
      for (const f of features) {
        score += Math.log(((c.features.get(f) || 0) + 1) / (totalF + cats.size));
      }
      if (score > bestScore) { bestScore = score; best = name; }
    }
    return best;
  }

  function getCategories() { return [...cats.keys()]; }
  return { learn, predict, getCategories };
}
