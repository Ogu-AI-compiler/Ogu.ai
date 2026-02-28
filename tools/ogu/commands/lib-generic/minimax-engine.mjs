/**
 * Minimax Engine — game tree evaluation.
 */
export function minimax(node, isMaximizing) {
  if (node.children.length === 0) return node.value;
  if (isMaximizing) {
    let best = -Infinity;
    for (const child of node.children) best = Math.max(best, minimax(child, false));
    return best;
  } else {
    let best = Infinity;
    for (const child of node.children) best = Math.min(best, minimax(child, true));
    return best;
  }
}
