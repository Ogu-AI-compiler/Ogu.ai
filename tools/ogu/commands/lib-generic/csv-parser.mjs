/**
 * CSV Parser — parse CSV strings into arrays/objects.
 */
export function parseCSV(text, options = {}) {
  const delimiter = options.delimiter || ',';
  const hasHeader = options.header !== false;
  const lines = text.trim().split('\n').map(l => l.split(delimiter).map(c => c.trim()));
  if (!hasHeader) return { rows: lines, headers: null };
  const headers = lines[0];
  const rows = lines.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
  return { headers, rows };
}
