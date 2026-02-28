/**
 * Simple glob matching — no npm dependency needed.
 * Supports: *, **, ?
 *
 * @param {string} str - String to test
 * @param {string} pattern - Glob pattern
 * @returns {boolean}
 */
export function minimatch(str, pattern) {
  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars (except * and ?)
    .replace(/\*\*/g, '§§')                  // Temp placeholder for **
    .replace(/\*/g, '[^/]*')                  // * = anything except /
    .replace(/§§/g, '.*')                     // ** = anything including /
    .replace(/\?/g, '[^/]');                  // ? = single char except /

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(str);
}
