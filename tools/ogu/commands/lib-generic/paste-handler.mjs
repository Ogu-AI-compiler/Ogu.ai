/**
 * Paste Handler — process pasted content with transformers.
 */
export function createPasteHandler() {
  const transformers = [];
  function addTransformer(name, fn) { transformers.push({ name, fn }); }
  function removeTransformer(name) {
    const idx = transformers.findIndex(t => t.name === name);
    if (idx >= 0) transformers.splice(idx, 1);
  }
  function process(content) {
    let result = content;
    for (const t of transformers) result = t.fn(result);
    return result;
  }
  function listTransformers() { return transformers.map(t => t.name); }
  return { addTransformer, removeTransformer, process, listTransformers };
}
