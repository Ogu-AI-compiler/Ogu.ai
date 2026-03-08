/**
 * Stemmer — simplified Porter-style stemmer.
 */
export function stem(word) {
  let w = word.toLowerCase();
  if (w.endsWith('ying')) return w.slice(0, -4) + 'y';
  if (w.endsWith('ning') && w.length > 6) return w.slice(0, -4);
  if (w.endsWith('ting') && w.length > 5) return w.slice(0, -4) + 'te';
  if (w.endsWith('ing') && w.length > 4) return w.slice(0, -3);
  if (w.endsWith('ily')) return w.slice(0, -3) + 'i';
  if (w.endsWith('ly') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  return w;
}
