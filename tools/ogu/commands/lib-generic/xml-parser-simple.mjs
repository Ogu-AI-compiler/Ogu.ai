/**
 * XML Parser Simple — parse simple XML strings into objects.
 */
export function parseXML(xml) {
  const tokens = [];
  const re = /<\/(\w+)>|<(\w+)([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) {
      tokens.push({ type: 'close', tag: m[1] });
    } else if (m[2]) {
      const attrs = {};
      const attrRe = /(\w+)="([^"]*)"/g;
      let am;
      while ((am = attrRe.exec(m[3] || '')) !== null) attrs[am[1]] = am[2];
      tokens.push({ type: 'open', tag: m[2], attrs });
    } else if (m[4] && m[4].trim()) {
      tokens.push({ type: 'text', value: m[4].trim() });
    }
  }
  function build(pos) {
    const children = [];
    let textVal = null;
    while (pos.i < tokens.length) {
      const tok = tokens[pos.i];
      if (tok.type === 'close') { pos.i++; break; }
      if (tok.type === 'text') { textVal = tok.value; pos.i++; continue; }
      if (tok.type === 'open') {
        const node = { tag: tok.tag, attrs: tok.attrs, children: null, text: null };
        pos.i++;
        const inner = build(pos);
        node.children = inner.children.length > 0 ? inner.children : null;
        node.text = inner.text;
        children.push(node);
      }
    }
    return { children, text: textVal };
  }
  return build({ i: 0 }).children;
}
