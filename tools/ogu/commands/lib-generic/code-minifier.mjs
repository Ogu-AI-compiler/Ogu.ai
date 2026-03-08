/**
 * Code Minifier — minify code by removing whitespace and comments.
 */
export function createCodeMinifier() {
  const transforms = [];
  function addTransform(name, fn) { transforms.push({ name, fn }); }
  function minify(code) {
    let result = code;
    for (const t of transforms) result = t.fn(result);
    return result;
  }
  function removeComments(code) {
    return code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  }
  function collapseWhitespace(code) {
    return code.replace(/\s+/g, ' ').trim();
  }
  function listTransforms() { return transforms.map(t => t.name); }
  return { addTransform, minify, removeComments, collapseWhitespace, listTransforms };
}
