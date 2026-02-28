/**
 * Red-Black Tree — self-balancing BST.
 */
const RED = true, BLACK = false;

export function createRedBlackTree() {
  let root = null;

  function createNode(key) { return { key, left: null, right: null, color: RED }; }

  function isRed(node) { return node !== null && node.color === RED; }

  function rotateLeft(h) {
    const x = h.right;
    h.right = x.left;
    x.left = h;
    x.color = h.color;
    h.color = RED;
    return x;
  }

  function rotateRight(h) {
    const x = h.left;
    h.left = x.right;
    x.right = h;
    x.color = h.color;
    h.color = RED;
    return x;
  }

  function flipColors(h) {
    h.color = RED;
    h.left.color = BLACK;
    h.right.color = BLACK;
  }

  function insertNode(node, key) {
    if (node === null) return createNode(key);
    if (key < node.key) node.left = insertNode(node.left, key);
    else if (key > node.key) node.right = insertNode(node.right, key);
    if (isRed(node.right) && !isRed(node.left)) node = rotateLeft(node);
    if (isRed(node.left) && isRed(node.left?.left)) node = rotateRight(node);
    if (isRed(node.left) && isRed(node.right)) flipColors(node);
    return node;
  }

  function insert(key) {
    root = insertNode(root, key);
    root.color = BLACK;
  }

  function searchNode(node, key) {
    if (node === null) return false;
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

  return { insert, search, inOrder };
}
