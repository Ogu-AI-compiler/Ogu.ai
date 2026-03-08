/**
 * Bayesian Classifier — simple Bayesian text classifier.
 */
export function createBayesianClassifier() {
  const categories = new Map();
  let totalDocs = 0;

  function train(category, words) {
    if (!categories.has(category)) categories.set(category, { count: 0, words: new Map() });
    const cat = categories.get(category);
    cat.count++;
    totalDocs++;
    for (const w of words) cat.words.set(w, (cat.words.get(w) || 0) + 1);
  }

  function classify(words) {
    let bestCat = null, bestScore = -Infinity;
    for (const [name, cat] of categories) {
      let score = Math.log(cat.count / totalDocs);
      const totalWords = [...cat.words.values()].reduce((a, b) => a + b, 0);
      for (const w of words) {
        score += Math.log(((cat.words.get(w) || 0) + 1) / (totalWords + categories.size));
      }
      if (score > bestScore) { bestScore = score; bestCat = name; }
    }
    return bestCat;
  }

  return { train, classify };
}
