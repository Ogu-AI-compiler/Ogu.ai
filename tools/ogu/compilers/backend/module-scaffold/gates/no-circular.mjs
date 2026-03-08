import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * MS005 — no-circular
 * Detect circular import chains between modules.
 * Uses a simple DFS through import statements to find cycles.
 */

function getAllTsFiles(dir) {
  const results = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.ogu', '.git', 'coverage'].includes(e.name)) continue;
      results.push(...getAllTsFiles(join(dir, e.name)));
    } else if (e.name.endsWith('.ts') && !e.name.includes('.d.ts')) {
      results.push(join(dir, e.name));
    }
  }
  return results;
}

function extractImports(content, filePath) {
  const dir = filePath.replace(/\/[^/]+$/, '');
  const importPattern = /(?:import|from)\s+['"](\.[^'"]+)['"]/g;
  const imports = [];
  let m;
  while ((m = importPattern.exec(content)) !== null) {
    // Resolve relative path
    const resolved = join(dir, m[1]);
    imports.push(resolved);
  }
  return imports;
}

function normalize(p) {
  // Try .ts extension if no extension
  if (!p.endsWith('.ts') && !p.endsWith('.js')) return p + '.ts';
  return p;
}

export async function run({ dir }) {
  const allFiles = getAllTsFiles(dir);

  // Build adjacency map
  const graph = new Map();
  for (const file of allFiles) {
    const content = readFileSync(file, 'utf8');
    const imports = extractImports(content, file).map(normalize);
    const existing = imports.filter(i => allFiles.includes(i));
    graph.set(file, existing);
  }

  // DFS cycle detection
  const visited = new Set();
  const inStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    if (inStack.has(node)) {
      const cycle = path.slice(path.indexOf(node));
      cycle.push(node);
      cycles.push(cycle.map(f => f.replace(dir + '/', '')).join(' → '));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);

    for (const neighbor of (graph.get(node) || [])) {
      dfs(neighbor, [...path, node]);
    }

    inStack.delete(node);
  }

  for (const file of allFiles) {
    if (!visited.has(file)) {
      dfs(file, []);
    }
  }

  if (cycles.length) {
    return {
      pass: false, code: 'MS005',
      message: `${cycles.length} circular import cycle(s) detected`,
      detail: cycles.slice(0, 5).join('\n') + (cycles.length > 5 ? `\n... and ${cycles.length - 5} more` : '')
    };
  }

  return {
    pass: true, code: 'MS005',
    message: `No circular imports detected across ${allFiles.length} files`
  };
}
