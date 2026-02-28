/**
 * Game Tree — tree structure for game state representation.
 */
export function createGameTree(rootId) {
  const children = new Map();
  const values = new Map();
  children.set(rootId, []);

  function addChild(parentId, childId) {
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(childId);
    children.set(childId, []);
  }
  function getChildren(id) { return children.get(id) || []; }
  function setValue(id, value) { values.set(id, value); }
  function getValue(id) { return values.get(id); }
  function getDepth(id) {
    const kids = children.get(id) || [];
    if (kids.length === 0) return 0;
    let max = 0;
    for (const c of kids) max = Math.max(max, getDepth(c));
    return max + 1;
  }
  return { addChild, getChildren, setValue, getValue, getDepth };
}
