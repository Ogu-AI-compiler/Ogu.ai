/**
 * Dictionary Store — store and look up word definitions.
 */
export function createDictionaryStore() {
  const entries = new Map();
  function define(word, definition, partOfSpeech = '') {
    if (!entries.has(word)) entries.set(word, []);
    entries.get(word).push({ definition, partOfSpeech });
  }
  function lookup(word) { return entries.get(word) || []; }
  function has(word) { return entries.has(word); }
  function remove(word) { entries.delete(word); }
  function listWords() { return [...entries.keys()]; }
  function count() { return entries.size; }
  return { define, lookup, has, remove, listWords, count };
}
