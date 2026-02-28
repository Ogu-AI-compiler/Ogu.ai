/**
 * Autocomplete Engine — prefix-based autocomplete suggestions.
 */
export function createAutocompleteEngine() {
  const entries = new Map();
  function add(term, weight = 1) { entries.set(term, (entries.get(term) || 0) + weight); }
  function remove(term) { entries.delete(term); }
  function suggest(prefix, limit = 5) {
    const p = prefix.toLowerCase();
    const matches = [];
    for (const [term, weight] of entries) {
      if (term.toLowerCase().startsWith(p)) matches.push({ term, weight });
    }
    matches.sort((a, b) => b.weight - a.weight);
    return matches.slice(0, limit).map(m => m.term);
  }
  function count() { return entries.size; }
  return { add, remove, suggest, count };
}
