/**
 * Stopword Filter — remove common stopwords from text.
 */
export function createStopwordFilter(stopwords = []) {
  const set = new Set(stopwords.map(w => w.toLowerCase()));
  function filter(words) { return words.filter(w => !set.has(w.toLowerCase())); }
  function addStopword(word) { set.add(word.toLowerCase()); }
  function isStopword(word) { return set.has(word.toLowerCase()); }
  return { filter, addStopword, isStopword };
}
