/**
 * AST Visitor — traverse AST nodes with visitor pattern.
 */
export function createASTVisitor() {
  const visitors = new Map();
  function on(type, fn) { visitors.set(type, fn); }
  function visit(node) {
    const handler = visitors.get(node.getType());
    if (handler) handler(node);
    for (const child of node.getChildren()) visit(child);
  }
  function visitWithResult(node, accumulator) {
    const handler = visitors.get(node.getType());
    if (handler) accumulator = handler(node, accumulator);
    for (const child of node.getChildren()) accumulator = visitWithResult(child, accumulator);
    return accumulator;
  }
  function listHandlers() { return [...visitors.keys()]; }
  return { on, visit, visitWithResult, listHandlers };
}
