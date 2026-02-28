/**
 * Memory Fabric — knowledge graph with pattern indexing and context queries.
 */

/**
 * Create a memory fabric for cross-project pattern storage.
 *
 * @returns {object} Fabric with indexPattern/query/getPatterns/mergeLearnings/removePattern
 */
export function createMemoryFabric() {
  const patterns = [];

  function indexPattern({ name, description, tags = [], content = '' }) {
    patterns.push({
      name,
      description,
      tags,
      content,
      indexedAt: new Date().toISOString(),
    });
  }

  function query(keyword) {
    const kw = keyword.toLowerCase();
    return patterns.filter(p =>
      p.name.toLowerCase().includes(kw) ||
      p.description.toLowerCase().includes(kw) ||
      p.tags.some(t => t.toLowerCase().includes(kw)) ||
      p.content.toLowerCase().includes(kw)
    );
  }

  function getPatterns() {
    return [...patterns];
  }

  function mergeLearnings(externalPatterns) {
    for (const p of externalPatterns) {
      if (!patterns.some(existing => existing.name === p.name)) {
        patterns.push({ ...p });
      }
    }
  }

  function removePattern(name) {
    const idx = patterns.findIndex(p => p.name === name);
    if (idx !== -1) patterns.splice(idx, 1);
  }

  return { indexPattern, query, getPatterns, mergeLearnings, removePattern };
}
