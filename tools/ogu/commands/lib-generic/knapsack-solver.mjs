/**
 * Knapsack Solver — 0/1 knapsack via dynamic programming.
 */
export function knapsack(items, capacity) {
  const n = items.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i-1][w];
      if (items[i-1].weight <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i-1][w - items[i-1].weight] + items[i-1].value);
      }
    }
  }
  const selected = [];
  let w = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i-1][w]) { selected.push(i-1); w -= items[i-1].weight; }
  }
  return { value: dp[n][capacity], selected };
}
