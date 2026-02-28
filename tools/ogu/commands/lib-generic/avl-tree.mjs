/**
 * AVL Tree — self-balancing BST with height-based rotation.
 */
export function createAVLTree() {
  let root = null;

  function createNode(key) { return { key, left: null, right: null, height: 1 }; }
  function getHeight(node) { return node ? node.height : 0; }
  function updateHeight(node) { node.height = 1 + Math.max(getHeight(node.left), getHeight(node.right)); }
  function getBalance(node) { return node ? getHeight(node.left) - getHeight(node.right) : 0; }

  function rotateRight(y) {
    const x = y.left, T = x.right;
    x.right = y; y.left = T;
    updateHeight(y); updateHeight(x);
    return x;
  }

  function rotateLeft(x) {
    const y = x.right, T = y.left;
    y.left = x; x.right = T;
    updateHeight(x); updateHeight(y);
    return y;
  }

  function insertNode(node, key) {
    if (!node) return createNode(key);
    if (key < node.key) node.left = insertNode(node.left, key);
    else if (key > node.key) node.right = insertNode(node.right, key);
    else return node;
    updateHeight(node);
    const balance = getBalance(node);
    if (balance > 1 && key < node.left.key) return rotateRight(node);
    if (balance < -1 && key > node.right.key) return rotateLeft(node);
    if (balance > 1 && key > node.left.key) { node.left = rotateLeft(node.left); return rotateRight(node); }
    if (balance < -1 && key < node.right.key) { node.right = rotateRight(node.right); return rotateLeft(node); }
    return node;
  }

  function insert(key) { root = insertNode(root, key); }

  function searchNode(node, key) {
    if (!node) return false;
    if (key === node.key) return true;
    return key < node.key ? searchNode(node.left, key) : searchNode(node.right, key);
  }

  function search(key) { return searchNode(root, key); }

  function inOrderTraverse(node, result) {
    if (!node) return;
    inOrderTraverse(node.left, result);
    result.push(node.key);
    inOrderTraverse(node.right, result);
  }

  function inOrder() { const r = []; inOrderTraverse(root, r); return r; }
  function height() { return getHeight(root); }

  return { insert, search, inOrder, height };
}
