/**
 * Treap — randomized BST with heap-ordered priorities.
 */
export function createTreap() {
  let root = null;
  function rotateRight(node) {
    const left = node.left;
    node.left = left.right;
    left.right = node;
    return left;
  }
  function rotateLeft(node) {
    const right = node.right;
    node.right = right.left;
    right.left = node;
    return right;
  }
  function insertNode(node, key, priority) {
    if (!node) return { key, priority, left: null, right: null };
    if (key < node.key) {
      node.left = insertNode(node.left, key, priority);
      if (node.left.priority > node.priority) node = rotateRight(node);
    } else if (key > node.key) {
      node.right = insertNode(node.right, key, priority);
      if (node.right.priority > node.priority) node = rotateLeft(node);
    }
    return node;
  }
  function insert(key) { root = insertNode(root, key, Math.random()); }
  function searchNode(node, key) {
    if (!node) return false;
    if (key === node.key) return true;
    return key < node.key ? searchNode(node.left, key) : searchNode(node.right, key);
  }
  function search(key) { return searchNode(root, key); }
  function inOrderCollect(node, result) {
    if (!node) return;
    inOrderCollect(node.left, result);
    result.push(node.key);
    inOrderCollect(node.right, result);
  }
  function inOrder() { const r = []; inOrderCollect(root, r); return r; }
  return { insert, search, inOrder };
}
