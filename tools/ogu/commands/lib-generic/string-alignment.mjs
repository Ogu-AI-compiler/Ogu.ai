/**
 * String Alignment — Needleman-Wunsch global alignment.
 */
export function needlemanWunsch(a, b, match = 1, mismatch = -1, gap = -1) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1);
    row[0] = i * gap;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j * gap;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const s = a[i-1] === b[j-1] ? match : mismatch;
      dp[i][j] = Math.max(dp[i-1][j-1] + s, dp[i-1][j] + gap, dp[i][j-1] + gap);
    }
  }
  let alignA = '', alignB = '', i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i-1][j-1] + (a[i-1]===b[j-1]?match:mismatch)) {
      alignA = a[--i] + alignA; alignB = b[--j] + alignB;
    } else if (i > 0 && dp[i][j] === dp[i-1][j] + gap) {
      alignA = a[--i] + alignA; alignB = '-' + alignB;
    } else { alignA = '-' + alignA; alignB = b[--j] + alignB; }
  }
  return { score: dp[m][n], alignA, alignB };
}
