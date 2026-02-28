import { acquireLock, releaseLock, listLocks } from './lib/file-lock.mjs';

/**
 * ogu lock:acquire --task <taskId> --files <path1,path2> --role <roleId>
 * ogu lock:release --task <taskId>
 * ogu lock:list
 */

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { task: null, files: null, role: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task' && args[i + 1]) result.task = args[++i];
    else if (args[i] === '--files' && args[i + 1]) result.files = args[++i].split(',');
    else if (args[i] === '--role' && args[i + 1]) result.role = args[++i];
  }
  return result;
}

export async function lockAcquire() {
  const args = parseArgs();
  if (!args.task || !args.files) {
    console.error('Usage: ogu lock:acquire --task <taskId> --files <path1,path2> --role <roleId>');
    return 1;
  }

  const result = acquireLock({
    files: args.files,
    roleId: args.role || 'unknown',
    taskId: args.task,
  });

  if (result.acquired) {
    console.log(`Acquired lock for ${args.task}: ${args.files.join(', ')}`);
  } else {
    console.error(`Lock conflict: ${result.reason}`);
    return 1;
  }

  return 0;
}

export async function lockRelease() {
  const args = parseArgs();
  if (!args.task) {
    console.error('Usage: ogu lock:release --task <taskId>');
    return 1;
  }

  const released = releaseLock(args.task);
  console.log(`Released ${released} lock(s) for ${args.task}`);
  return 0;
}

export async function lockList() {
  const locks = listLocks();

  if (locks.length === 0) {
    console.log('No active locks.');
    return 0;
  }

  console.log(`\n  Active Locks (${locks.length}):\n`);
  for (const lock of locks) {
    console.log(`  ${lock.taskId.padEnd(20)} ${lock.roleId.padEnd(14)} ${lock.files.join(', ')}`);
    console.log(`    Since: ${lock.acquiredAt}`);
  }
  console.log('');
  return 0;
}
