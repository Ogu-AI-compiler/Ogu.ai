/**
 * Lexer State Machine — tokenize input using state-based rules.
 */
export function createLexerStateMachine() {
  const states = {};

  function addState(name, rules) {
    states[name] = rules;
  }

  function tokenize(input, stateName = "default") {
    const rules = states[stateName] || [];
    const tokens = [];
    let pos = 0;

    while (pos < input.length) {
      let matched = false;
      for (const rule of rules) {
        const regex = new RegExp(rule.pattern.source, "y");
        regex.lastIndex = pos;
        const match = regex.exec(input);
        if (match) {
          if (!rule.skip) {
            tokens.push({ type: rule.type, value: match[0], offset: pos });
          }
          pos = regex.lastIndex;
          matched = true;
          break;
        }
      }
      if (!matched) pos++;
    }

    return tokens;
  }

  return { addState, tokenize };
}
