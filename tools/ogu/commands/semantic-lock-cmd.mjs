/**
 * Semantic Lock CLI Commands — symbol-level lock acquisition and release.
 *
 * semantic:lock:acquire --file <path> --symbol <name> --task <taskId> [--role <roleId>]
 * semantic:lock:release --file <path> --symbol <name> --task <taskId>
 */

import { repoRoot } from '../util.mjs';
import { acquireSymbolLock, releaseSymbolLock, extractSymbols } from './lib/semantic-mutex.mjs';
import { join } from 'node:path';

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { file: null, symbol: null, task: null, role: null, json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) { result.file = args[++i]; continue; }
    if (args[i] === '--symbol' && args[i + 1]) { result.symbol = args[++i]; continue; }
    if (args[i] === '--task' && args[i + 1]) { result.task = args[++i]; continue; }
    if (args[i] === '--role' && args[i + 1]) { result.role = args[++i]; continue; }
    if (args[i] === '--json') { result.json = true; continue; }
  }
  return result;
}

/**
 * ogu semantic:lock:acquire --file <path> --symbol <name> --task <taskId> [--role <roleId>]
 *
 * Acquire a semantic lock on a specific symbol (function, class, export)
 * within a file. This allows parallel work on the same file as long as
 * agents target different symbols.
 */
export async function semanticLockAcquire() {
  const root = repoRoot();
  const { file, symbol, task, role, json } = parseArgs();

  if (!file || !symbol || !task) {
    console.error('Usage: ogu semantic:lock:acquire --file <path> --symbol <name> --task <taskId> [--role <roleId>]');
    return 1;
  }

  const filePath = join(root, file);

  // Verify symbol exists in the file
  const symbols = extractSymbols({ filePath });
  const found = symbols.find(s => s.name === symbol);
  if (!found) {
    console.error(`Symbol "${symbol}" not found in ${file}`);
    console.error(`Available symbols: ${symbols.map(s => s.name).join(', ') || 'none'}`);
    return 1;
  }

  const result = acquireSymbolLock({
    root,
    filePath: file,
    symbol,
    roleId: role || 'unknown',
    taskId: task,
  });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return result.acquired ? 0 : 1;
  }

  if (result.acquired) {
    console.log(`LOCK ACQUIRED`);
    console.log(`  File:   ${file}`);
    console.log(`  Symbol: ${symbol} (${found.type}, line ${found.line})`);
    console.log(`  Task:   ${task}`);
    console.log(`  Lock:   ${result.lockId}`);
  } else {
    console.error(`LOCK DENIED`);
    console.error(`  File:   ${file}`);
    console.error(`  Symbol: ${symbol}`);
    console.error(`  Reason: ${result.reason}`);
    if (result.heldBy) {
      console.error(`  Held by task: ${result.heldBy}`);
    }
  }

  return result.acquired ? 0 : 1;
}

/**
 * ogu semantic:lock:release --file <path> --symbol <name> --task <taskId>
 *
 * Release a previously acquired semantic lock on a symbol.
 */
export async function semanticLockRelease() {
  const root = repoRoot();
  const { file, symbol, task, json } = parseArgs();

  if (!file || !symbol || !task) {
    console.error('Usage: ogu semantic:lock:release --file <path> --symbol <name> --task <taskId>');
    return 1;
  }

  const result = releaseSymbolLock({
    root,
    filePath: file,
    symbol,
    taskId: task,
  });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return result.released ? 0 : 1;
  }

  if (result.released) {
    console.log(`LOCK RELEASED`);
    console.log(`  File:   ${file}`);
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Task:   ${task}`);
  } else {
    console.log(`RELEASE SKIPPED`);
    console.log(`  File:   ${file}`);
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Reason: ${result.reason || 'lock not found or not owned by task'}`);
  }

  return result.released ? 0 : 1;
}
