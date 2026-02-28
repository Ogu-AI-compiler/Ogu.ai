/**
 * B-Tree Index — balanced tree for ordered key storage.
 */
export function createBTree(order = 3) {
  const minKeys = Math.ceil(order / 2) - 1;

  function createNode(leaf = true) {
    return { keys: [], children: [], leaf };
  }

  let root = createNode();

  function searchNode(node, key) {
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) i++;
    if (i < node.keys.length && node.keys[i] === key) return true;
    if (node.leaf) return false;
    return searchNode(node.children[i], key);
  }

  function search(key) {
    return searchNode(root, key);
  }

  function splitChild(parent, idx) {
    const child = parent.children[idx];
    const mid = Math.floor((order - 1) / 2);
    const newNode = createNode(child.leaf);
    newNode.keys = child.keys.splice(mid + 1);
    const midKey = child.keys.pop();
    if (!child.leaf) {
      newNode.children = child.children.splice(mid + 1);
    }
    parent.keys.splice(idx, 0, midKey);
    parent.children.splice(idx + 1, 0, newNode);
  }

  function insertNonFull(node, key) {
    let i = node.keys.length - 1;
    if (node.leaf) {
      while (i >= 0 && key < node.keys[i]) i--;
      node.keys.splice(i + 1, 0, key);
    } else {
      while (i >= 0 && key < node.keys[i]) i--;
      i++;
      if (node.children[i].keys.length === order - 1) {
        splitChild(node, i);
        if (key > node.keys[i]) i++;
      }
      insertNonFull(node.children[i], key);
    }
  }

  function insert(key) {
    if (root.keys.length === order - 1) {
      const newRoot = createNode(false);
      newRoot.children.push(root);
      splitChild(newRoot, 0);
      root = newRoot;
    }
    insertNonFull(root, key);
  }

  function inOrderTraverse(node, result) {
    for (let i = 0; i < node.keys.length; i++) {
      if (!node.leaf) inOrderTraverse(node.children[i], result);
      result.push(node.keys[i]);
    }
    if (!node.leaf) inOrderTraverse(node.children[node.keys.length], result);
  }

  function inOrder() {
    const result = [];
    inOrderTraverse(root, result);
    return result;
  }

  return { insert, search, inOrder };
}
