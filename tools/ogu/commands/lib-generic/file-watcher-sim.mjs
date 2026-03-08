/**
 * File Watcher Simulator — simulated file change events with pattern matching.
 */
let nextId = 1;

export function createFileWatcher() {
  const watchers = new Map();

  function watch(pattern, handler) {
    const id = `w-${nextId++}`;
    watchers.set(id, { pattern, handler });
    return id;
  }

  function unwatch(id) { watchers.delete(id); }

  function emit(event) {
    for (const [, w] of watchers) {
      if (matchPattern(w.pattern, event.path)) {
        w.handler(event);
      }
    }
  }

  return { watch, unwatch, emit };
}

function matchPattern(pattern, path) {
  if (pattern === '**') return true;
  if (pattern.endsWith('/**')) {
    return path.startsWith(pattern.slice(0, -3));
  }
  if (pattern.endsWith('/**/*.ts')) {
    return path.startsWith(pattern.slice(0, -8)) && path.endsWith('.ts');
  }
  return path.startsWith(pattern.replace(/\*\*/g, ''));
}
