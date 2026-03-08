/**
 * AST Optimizer — constant folding and tree simplification.
 */
const OPS = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => a / b,
};

export function optimize(node) {
  if (!node || node.type === "literal" || node.type === "variable") return node;

  const left = node.left ? optimize(node.left) : undefined;
  const right = node.right ? optimize(node.right) : undefined;

  if (OPS[node.type] && left?.type === "literal" && right?.type === "literal") {
    return { type: "literal", value: OPS[node.type](left.value, right.value) };
  }

  return { ...node, left, right };
}
