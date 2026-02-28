/**
 * Alpha-Beta Pruner — minimax with alpha-beta pruning.
 */
export function alphaBeta(node, isMaximizing, alpha, beta) {
  if (node.children.length === 0) return node.value;
  if (isMaximizing) {
    let value = -Infinity;
    for (const child of node.children) {
      value = Math.max(value, alphaBeta(child, false, alpha, beta));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const child of node.children) {
      value = Math.min(value, alphaBeta(child, true, alpha, beta));
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return value;
  }
}
