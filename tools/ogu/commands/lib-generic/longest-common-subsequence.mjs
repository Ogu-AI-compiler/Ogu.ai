/**
 * Longest Common Subsequence — classic DP solution.
 */
export function lcs(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1] + 1;
      else dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }
  // Backtrack
  let result = '';
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i-1] === b[j-1]) { result = a[i-1] + result; i--; j--; }
    else if (dp[i-1][j] > dp[i][j-1]) i--;
    else j--;
  }
  return result;
}
