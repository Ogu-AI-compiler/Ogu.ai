/**
 * Pattern Glob — match file paths against glob patterns.
 */
export function matchGlob(pattern, path) {
  const regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`).test(path);
}

export function filterGlob(pattern, paths) {
  return paths.filter(p => matchGlob(pattern, p));
}

export function createGlobMatcher(patterns) {
  function match(path) {
    return patterns.some(p => matchGlob(p, path));
  }
  function filter(paths) { return paths.filter(match); }
  return { match, filter };
}
