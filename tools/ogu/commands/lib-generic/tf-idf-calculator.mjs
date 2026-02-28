/**
 * TF-IDF Calculator — term frequency-inverse document frequency.
 */
export function createTfIdf() {
  const documents = [];

  function addDocument(words) { documents.push(words); }

  function tf(word, docIndex) {
    const doc = documents[docIndex];
    const count = doc.filter(w => w === word).length;
    return count / doc.length;
  }

  function idf(word) {
    const docsWithWord = documents.filter(doc => doc.includes(word)).length;
    return Math.log((documents.length + 1) / (docsWithWord + 1)) + 1;
  }

  function scores(docIndex) {
    const doc = documents[docIndex];
    const unique = [...new Set(doc)];
    const result = {};
    for (const w of unique) result[w] = tf(w, docIndex) * idf(w);
    return result;
  }

  return { addDocument, scores };
}
