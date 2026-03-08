/**
 * Gate: no-circular
 * Detects circular schema references using static import analysis.
 * Reads schema.ts, extracts which schemas reference other schemas by name,
 * then runs DFS to find cycles.
 */
import { readFileSync, existsSync } from "fs";

export async function run({ dir }) {
  const schemaPath = `${dir}/schema.ts`;
  if (!existsSync(schemaPath)) {
    return { pass: false, code: "SC011", message: "schema.ts not found" };
  }

  const content = readFileSync(schemaPath, "utf8");

  // Extract all schema declarations: const FooSchema = z.object({ ... })
  const schemaDecls = [...content.matchAll(/const\s+(\w+Schema)\s*=/g)].map(m => m[1]);

  if (schemaDecls.length <= 1) {
    return { pass: true, detail: { schemas: schemaDecls.length, note: "Single schema — no circular deps possible" } };
  }

  // Build adjacency map: for each schema, which other schemas does it reference?
  const graph = new Map();
  for (const schemaName of schemaDecls) {
    // Find the definition block for this schema
    const startIdx = content.indexOf(`const ${schemaName}`);
    if (startIdx === -1) { graph.set(schemaName, []); continue; }

    // Extract until the next `const ...Schema` or end of file
    const nextDecl = content.slice(startIdx + 1).search(/const\s+\w+Schema\s*=/);
    const block = nextDecl >= 0
      ? content.slice(startIdx, startIdx + 1 + nextDecl)
      : content.slice(startIdx);

    // Find references to other schemas within this block
    const refs = schemaDecls.filter(other => {
      if (other === schemaName) return false;
      return new RegExp(`\\b${other}\\b`).test(block);
    });

    graph.set(schemaName, refs);
  }

  // DFS cycle detection
  const cycles = [];
  const visited = new Set();
  const stack = new Set();

  function dfs(node, path) {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).concat(node).join(" → "));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);

    for (const neighbor of (graph.get(node) || [])) {
      dfs(neighbor, [...path, node]);
    }

    stack.delete(node);
  }

  for (const schema of schemaDecls) {
    dfs(schema, []);
  }

  if (cycles.length) {
    return {
      pass: false,
      code: "SC011",
      message: `${cycles.length} circular reference(s) detected`,
      detail: {
        cycles,
        hint: "Use z.lazy(() => FooSchema) to break circular references",
      },
    };
  }

  return {
    pass: true,
    detail: { schemas: schemaDecls.length, edges: [...graph.values()].flat().length },
  };
}
