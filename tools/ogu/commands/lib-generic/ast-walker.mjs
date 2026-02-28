/**
 * AST Walker — traverse AST with visitor pattern.
 */

/**
 * Walk an AST tree, calling enter/leave on each node.
 * @param {object} node
 * @param {{ enter?: Function, leave?: Function }} visitor
 */
export function walk(node, visitor) {
  if (visitor.enter) visitor.enter(node);

  const children = node.children || [];
  for (const child of children) {
    walk(child, visitor);
  }

  if (visitor.leave) visitor.leave(node);
}

/**
 * Collect all nodes of a given type.
 * @param {object} root
 * @param {string} type
 * @returns {Array}
 */
export function collect(root, type) {
  const result = [];
  walk(root, {
    enter: (node) => {
      if (node.type === type) result.push(node);
    },
  });
  return result;
}
