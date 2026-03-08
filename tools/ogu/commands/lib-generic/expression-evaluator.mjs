/**
 * Expression Evaluator — evaluate arithmetic expressions with variables.
 */
export function evaluate(expr, vars = {}) {
  const tokens = tokenize(expr, vars);
  const result = parseExpr(tokens, 0);
  return result.value;
}

function tokenize(expr, vars) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === " ") { i++; continue; }
    if (expr[i] === "(" || expr[i] === ")") {
      tokens.push({ type: "paren", value: expr[i] }); i++; continue;
    }
    if ("+-*/".includes(expr[i])) {
      tokens.push({ type: "op", value: expr[i] }); i++; continue;
    }
    if (expr[i] >= "0" && expr[i] <= "9") {
      let num = "";
      while (i < expr.length && ((expr[i] >= "0" && expr[i] <= "9") || expr[i] === ".")) num += expr[i++];
      tokens.push({ type: "num", value: parseFloat(num) }); continue;
    }
    if (expr[i].match(/[a-zA-Z_]/)) {
      let name = "";
      while (i < expr.length && expr[i].match(/[a-zA-Z0-9_]/)) name += expr[i++];
      tokens.push({ type: "num", value: vars[name] !== undefined ? vars[name] : 0 }); continue;
    }
    i++;
  }
  return tokens;
}

function parseExpr(tokens, pos) {
  let left = parseTerm(tokens, pos);
  while (left.pos < tokens.length && tokens[left.pos]?.type === "op" && (tokens[left.pos].value === "+" || tokens[left.pos].value === "-")) {
    const op = tokens[left.pos].value;
    const right = parseTerm(tokens, left.pos + 1);
    left = { value: op === "+" ? left.value + right.value : left.value - right.value, pos: right.pos };
  }
  return left;
}

function parseTerm(tokens, pos) {
  let left = parseFactor(tokens, pos);
  while (left.pos < tokens.length && tokens[left.pos]?.type === "op" && (tokens[left.pos].value === "*" || tokens[left.pos].value === "/")) {
    const op = tokens[left.pos].value;
    const right = parseFactor(tokens, left.pos + 1);
    left = { value: op === "*" ? left.value * right.value : left.value / right.value, pos: right.pos };
  }
  return left;
}

function parseFactor(tokens, pos) {
  if (tokens[pos]?.type === "paren" && tokens[pos].value === "(") {
    const result = parseExpr(tokens, pos + 1);
    return { value: result.value, pos: result.pos + 1 }; // skip ")"
  }
  return { value: tokens[pos].value, pos: pos + 1 };
}
