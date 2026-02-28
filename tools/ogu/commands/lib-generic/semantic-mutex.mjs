import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

/**
 * Semantic Mutex — AST-aware file locking at symbol level.
 *
 * Locks individual functions, classes, or exported symbols
 * rather than entire files, allowing parallel work on the same file.
 */

/**
 * Extract symbol names from a source file (lightweight regex-based).
 *
 * @param {object} opts
 * @param {string} opts.filePath - Absolute path to source file
 * @returns {Array<{ name: string, type: string, line: number }>}
 */
export function extractSymbols({ filePath }) {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const symbols = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Functions: export function name, function name, const name = ()
    const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      symbols.push({ name: funcMatch[1], type: 'function', line: i + 1 });
      continue;
    }

    // Arrow functions: export const name = (
    const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:\(|async\s*\()/);
    if (arrowMatch) {
      symbols.push({ name: arrowMatch[1], type: 'function', line: i + 1 });
      continue;
    }

    // Classes: export class Name
    const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
    if (classMatch) {
      symbols.push({ name: classMatch[1], type: 'class', line: i + 1 });
      continue;
    }
  }

  return symbols;
}

function lockKey(filePath, symbol) {
  return `${filePath}::${symbol}`.replace(/[/\\]/g, '__');
}

/**
 * Acquire a symbol-level lock.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} opts.filePath - Relative file path
 * @param {string} opts.symbol - Symbol name to lock
 * @param {string} opts.roleId
 * @param {string} opts.taskId
 * @returns {{ id, filePath, symbol, roleId, taskId }}
 * @throws If symbol is already locked by another task
 */
export function acquireSymbolLock({ root, filePath, symbol, roleId, taskId } = {}) {
  root = root || repoRoot();
  const lockDir = join(root, '.ogu/locks/symbols');
  mkdirSync(lockDir, { recursive: true });

  const key = lockKey(filePath, symbol);
  const lockPath = join(lockDir, `${key}.json`);

  if (existsSync(lockPath)) {
    const existing = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (existing.taskId !== taskId) {
      throw new Error(`Symbol "${symbol}" in ${filePath} is locked by task ${existing.taskId} (conflict)`);
    }
    return existing;
  }

  const lock = {
    id: randomUUID(),
    filePath,
    symbol,
    roleId,
    taskId,
    acquiredAt: new Date().toISOString(),
  };

  writeFileSync(lockPath, JSON.stringify(lock, null, 2));
  return lock;
}

/**
 * Release a symbol-level lock.
 */
export function releaseSymbolLock({ root, filePath, symbol, taskId } = {}) {
  root = root || repoRoot();
  const lockDir = join(root, '.ogu/locks/symbols');
  const key = lockKey(filePath, symbol);
  const lockPath = join(lockDir, `${key}.json`);

  if (existsSync(lockPath)) {
    const existing = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (existing.taskId === taskId) {
      unlinkSync(lockPath);
      return true;
    }
  }

  return false;
}
