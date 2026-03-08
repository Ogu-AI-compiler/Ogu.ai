/**
 * XML Builder — build XML strings programmatically.
 */
export function createXMLBuilder() {
  const parts = [];
  let indentLevel = 0;
  const indent = '  ';
  function open(tag, attrs = {}) {
    const attrStr = Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
    parts.push(`${indent.repeat(indentLevel)}<${tag}${attrStr}>`);
    indentLevel++;
    return api;
  }
  function close(tag) {
    indentLevel--;
    parts.push(`${indent.repeat(indentLevel)}</${tag}>`);
    return api;
  }
  function text(content) { parts.push(`${indent.repeat(indentLevel)}${content}`); return api; }
  function selfClose(tag, attrs = {}) {
    const attrStr = Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
    parts.push(`${indent.repeat(indentLevel)}<${tag}${attrStr} />`);
    return api;
  }
  function build() { return parts.join('\n'); }
  const api = { open, close, text, selfClose, build };
  return api;
}
