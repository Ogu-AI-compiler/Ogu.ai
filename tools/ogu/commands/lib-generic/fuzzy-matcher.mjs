/**
 * Fuzzy Matcher — approximate string matching using Levenshtein distance.
 */
export function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

export function fuzzyMatch(query, items) {
  return items
    .map(item => ({ item, distance: levenshteinDistance(query, item) }))
    .sort((a, b) => a.distance - b.distance);
}
