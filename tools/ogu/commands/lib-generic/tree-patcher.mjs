/**
 * Tree Patcher — apply diff operations to an object tree.
 */
export function patchTree(tree, operations) {
  const result = JSON.parse(JSON.stringify(tree));
  for (const op of operations) {
    const parts = op.path.split('/').filter(Boolean);
    const key = parts[parts.length - 1];
    let target = result;
    for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
    switch (op.op) {
      case 'add': target[key] = op.value; break;
      case 'remove': delete target[key]; break;
      case 'replace': target[key] = op.value; break;
    }
  }
  return result;
}
