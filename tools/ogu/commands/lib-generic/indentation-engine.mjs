/**
 * Indentation Engine — manage code indentation levels.
 */
export function createIndentationEngine(char = '  ') {
  let level = 0;
  function indent() { level++; }
  function dedent() { if (level > 0) level--; }
  function getLevel() { return level; }
  function getPrefix() { return char.repeat(level); }
  function indentLine(line) { return getPrefix() + line; }
  function indentBlock(lines) { return lines.map(l => indentLine(l)); }
  function reset() { level = 0; }
  return { indent, dedent, getLevel, getPrefix, indentLine, indentBlock, reset };
}
