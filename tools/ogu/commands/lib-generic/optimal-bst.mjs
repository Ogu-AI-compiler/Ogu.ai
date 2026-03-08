/**
 * Optimal BST — minimum expected search cost.
 */
export function optimalBSTCost(freq) {
  const n = freq.length;
  const dp = Array.from({ length: n }, () => new Array(n).fill(0));
  const sum = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) { sum[i][i] = freq[i]; dp[i][i] = freq[i]; }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) sum[i][j] = sum[i][j-1] + freq[j];
  }
  for (let len = 2; len <= n; len++) {
    for (let i = 0; i <= n - len; i++) {
      const j = i + len - 1;
      dp[i][j] = Infinity;
      for (let r = i; r <= j; r++) {
        const cost = (r > i ? dp[i][r-1] : 0) + (r < j ? dp[r+1][j] : 0) + sum[i][j];
        if (cost < dp[i][j]) dp[i][j] = cost;
      }
    }
  }
  return dp[0][n-1];
}
