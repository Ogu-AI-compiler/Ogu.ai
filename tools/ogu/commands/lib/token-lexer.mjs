/**
 * Token Lexer — tokenize input streams into typed tokens.
 */

export function createLexer() {
  const rules = [];

  function addRule({ type, pattern, skip = false }) {
    rules.push({ type, pattern, skip });
  }

  function tokenize(input) {
    const tokens = [];
    let pos = 0;

    while (pos < input.length) {
      let matched = false;

      for (const rule of rules) {
        const regex = new RegExp(rule.pattern.source, "y");
        regex.lastIndex = pos;
        const m = regex.exec(input);
        if (m) {
          if (!rule.skip) {
            tokens.push({
              type: rule.type,
              value: m[0],
              offset: pos,
              length: m[0].length,
            });
          }
          pos += m[0].length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        pos++; // skip unrecognized character
      }
    }

    return tokens;
  }

  return { addRule, tokenize };
}
