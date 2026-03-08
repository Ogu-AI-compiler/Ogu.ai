/**
 * Spell Checker — check spelling using a dictionary with edit distance.
 */
export function createSpellChecker(dictionary = []) {
  const dict = new Set(dictionary.map(w => w.toLowerCase()));
  function _editDist(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }
  function addWord(word) { dict.add(word.toLowerCase()); }
  function check(word) { return dict.has(word.toLowerCase()); }
  function suggest(word, maxDist = 2) {
    const w = word.toLowerCase();
    const suggestions = [];
    for (const d of dict) {
      const dist = _editDist(w, d);
      if (dist > 0 && dist <= maxDist) suggestions.push({ word: d, distance: dist });
    }
    suggestions.sort((a, b) => a.distance - b.distance);
    return suggestions.map(s => s.word);
  }
  function size() { return dict.size; }
  return { addWord, check, suggest, size };
}
