/**
 * Dead Code Eliminator — remove unreachable and unused code.
 */
export function eliminateDeadCode(ast) {
  if (ast.type !== "block") return ast;
  const statements = [];
  for (const stmt of ast.statements) {
    statements.push(stmt);
    if (stmt.type === "return" || stmt.type === "throw") break;
  }
  return { ...ast, statements };
}

export function removeUnused(ast, unusedNames) {
  if (ast.type !== "block") return ast;
  const statements = ast.statements.filter(stmt => {
    if (stmt.type === "assign" && unusedNames.includes(stmt.name)) return false;
    return true;
  });
  return { ...ast, statements };
}
