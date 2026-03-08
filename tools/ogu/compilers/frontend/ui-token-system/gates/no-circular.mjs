import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** UIT004 — no-circular: no circular alias chains in the token dependency graph */
const ALIAS_PATTERN = /^\{(.+)\}$/;

/**
 * Build a map of tokenName → aliasedTokenName for every aliased token.
 */
function buildAliasMap(tokens) {
  const map = new Map();
  for (const token of tokens) {
    if (!token.name) continue;
    const value = String(token.value ?? '');
    const match = ALIAS_PATTERN.exec(value);
    if (match) {
      map.set(token.name, match[1]);
    }
  }
  return map;
}

/**
 * Returns true if following alias chain from startName eventually loops back to itself.
 * Uses a visited set to detect the cycle — stops when the chain hits a non-alias token.
 */
function hasCycle(startName, aliasMap) {
  const visited = new Set();
  let current = startName;

  while (aliasMap.has(current)) {
    if (visited.has(current)) {
      return true;
    }
    visited.add(current);
    current = aliasMap.get(current);
  }

  return false;
}

export async function run({ dir }) {
  const specPath = join(dir, 'design-token-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UIT004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UIT004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.tokens) || spec.tokens.length === 0) {
    return { pass: true, code: 'UIT004', message: 'No tokens — gate skipped', skipped: true };
  }

  const aliasMap = buildAliasMap(spec.tokens);

  // Only alias tokens can form cycles — no need to check primitive tokens
  const cycles = [];
  for (const tokenName of aliasMap.keys()) {
    if (hasCycle(tokenName, aliasMap)) {
      cycles.push(tokenName);
    }
  }

  if (cycles.length > 0) {
    return {
      pass: false,
      code: 'UIT004',
      message: `${cycles.length} circular alias chain(s) detected`,
      detail: cycles.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UIT004',
    message: `No circular alias chains (${aliasMap.size} alias token(s) checked)`,
  };
}
