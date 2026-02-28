/**
 * Tree Diff — compute diff operations between two object trees.
 */
export function treeDiff(oldTree, newTree, prefix = '') {
  const ops = [];
  const allKeys = new Set([...Object.keys(oldTree || {}), ...Object.keys(newTree || {})]);
  for (const key of allKeys) {
    const path = `${prefix}/${key}`;
    const inOld = oldTree && key in oldTree;
    const inNew = newTree && key in newTree;
    if (!inOld && inNew) {
      ops.push({ op: 'add', path, value: newTree[key] });
    } else if (inOld && !inNew) {
      ops.push({ op: 'remove', path });
    } else if (inOld && inNew) {
      if (typeof oldTree[key] === 'object' && typeof newTree[key] === 'object' &&
          oldTree[key] !== null && newTree[key] !== null && !Array.isArray(oldTree[key])) {
        ops.push(...treeDiff(oldTree[key], newTree[key], path));
      } else if (oldTree[key] !== newTree[key]) {
        ops.push({ op: 'replace', path, value: newTree[key] });
      }
    }
  }
  return ops;
}
