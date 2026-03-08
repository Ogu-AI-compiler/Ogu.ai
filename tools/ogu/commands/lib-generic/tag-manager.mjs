/**
 * Tag Manager — manage tags/labels on resources.
 */
export function createTagManager() {
  const tags = new Map();
  function addTag(resource, tag) {
    if (!tags.has(resource)) tags.set(resource, new Set());
    tags.get(resource).add(tag);
  }
  function removeTag(resource, tag) {
    const set = tags.get(resource);
    if (set) set.delete(tag);
  }
  function getTags(resource) { return [...(tags.get(resource) || [])]; }
  function findByTag(tag) {
    const result = [];
    for (const [resource, tagSet] of tags) {
      if (tagSet.has(tag)) result.push(resource);
    }
    return result;
  }
  function listResources() { return [...tags.keys()]; }
  return { addTag, removeTag, getTags, findByTag, listResources };
}
