/**
 * Bookmark Store — save and retrieve named bookmarks.
 */
export function createBookmarkStore() {
  const bookmarks = new Map();
  function add(name, location, tags = []) {
    bookmarks.set(name, { name, location, tags, createdAt: Date.now() });
  }
  function get(name) { const b = bookmarks.get(name); return b ? { ...b } : null; }
  function remove(name) { bookmarks.delete(name); }
  function list() { return [...bookmarks.values()]; }
  function findByTag(tag) { return [...bookmarks.values()].filter(b => b.tags.includes(tag)); }
  function count() { return bookmarks.size; }
  return { add, get, remove, list, findByTag, count };
}
