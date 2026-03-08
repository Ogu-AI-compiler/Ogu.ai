/**
 * JSON Patch Engine — RFC 6902 JSON Patch operations.
 */
export function applyPatch(doc, operations) {
  const result = JSON.parse(JSON.stringify(doc));
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
