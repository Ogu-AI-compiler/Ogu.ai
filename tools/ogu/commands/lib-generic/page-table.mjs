/**
 * Page Table — maps virtual pages to physical frames.
 */
export function createPageTable({ pageSize }) {
  const entries = new Map();
  function map(virtualPage, physicalFrame) { entries.set(virtualPage, physicalFrame); }
  function unmap(virtualPage) { entries.delete(virtualPage); }
  function translate(virtualPage) { return entries.has(virtualPage) ? entries.get(virtualPage) : null; }
  function getEntries() { return [...entries.entries()].map(([v, p]) => ({ virtualPage: v, physicalFrame: p })); }
  return { map, unmap, translate, getEntries };
}
