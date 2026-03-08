/**
 * Abstract Syntax Tree — build and manipulate ASTs.
 */
export function createAST(type, value = null) {
  const children = [];
  const meta = {};
  function addChild(child) { children.push(child); return child; }
  function getChildren() { return [...children]; }
  function getType() { return type; }
  function getValue() { return value; }
  function setMeta(key, val) { meta[key] = val; }
  function getMeta(key) { return meta[key]; }
  function toJSON() {
    return { type, value, meta: { ...meta }, children: children.map(c => c.toJSON()) };
  }
  function depth() {
    if (children.length === 0) return 0;
    return 1 + Math.max(...children.map(c => c.depth()));
  }
  return { addChild, getChildren, getType, getValue, setMeta, getMeta, toJSON, depth };
}
