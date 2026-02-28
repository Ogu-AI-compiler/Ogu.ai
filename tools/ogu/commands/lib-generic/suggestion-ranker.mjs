/**
 * Suggestion Ranker — rank suggestions by multiple criteria.
 */
export function createSuggestionRanker() {
  const criteria = [];
  function addCriterion(name, scoreFn, weight = 1) {
    criteria.push({ name, scoreFn, weight });
  }
  function rank(items) {
    const scored = items.map(item => {
      let total = 0;
      for (const c of criteria) total += c.scoreFn(item) * c.weight;
      return { item, score: total };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }
  function listCriteria() { return criteria.map(c => c.name); }
  return { addCriterion, rank, listCriteria };
}
