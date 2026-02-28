/**
 * Global Search Engine — full-text search across features, audit, artifacts.
 *
 * In-memory inverted index for fast keyword search with type filtering.
 */

/**
 * Create a search engine.
 *
 * @returns {object} Engine with index/search/getStats
 */
export function createSearchEngine() {
  const documents = new Map();
  const invertedIndex = new Map(); // word → Set<docId>

  function tokenize(text) {
    return text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
  }

  function index({ id, type, content, metadata }) {
    const doc = { id, type, content, metadata };
    documents.set(id, doc);

    const tokens = tokenize(content);
    for (const token of tokens) {
      if (!invertedIndex.has(token)) invertedIndex.set(token, new Set());
      invertedIndex.get(token).add(id);
    }
  }

  function search(query, opts = {}) {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    // Find documents matching all tokens
    let matchingIds = null;
    for (const token of tokens) {
      const ids = invertedIndex.get(token);
      if (!ids) return [];
      if (matchingIds === null) {
        matchingIds = new Set(ids);
      } else {
        for (const id of matchingIds) {
          if (!ids.has(id)) matchingIds.delete(id);
        }
      }
    }

    let results = Array.from(matchingIds).map(id => documents.get(id));

    // Filter by type if specified
    if (opts.type) {
      results = results.filter(doc => doc.type === opts.type);
    }

    return results;
  }

  function getStats() {
    const byType = {};
    for (const doc of documents.values()) {
      byType[doc.type] = (byType[doc.type] || 0) + 1;
    }
    return {
      totalDocuments: documents.size,
      totalTerms: invertedIndex.size,
      byType,
    };
  }

  return { index, search, getStats };
}
