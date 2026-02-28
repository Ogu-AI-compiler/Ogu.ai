/**
 * CSV Serializer — serialize objects/arrays to CSV strings.
 */
export function serializeCSV(data, options = {}) {
  const delimiter = options.delimiter || ',';
  if (data.length === 0) return '';
  if (typeof data[0] === 'object' && !Array.isArray(data[0])) {
    const headers = Object.keys(data[0]);
    const lines = [headers.join(delimiter)];
    for (const row of data) lines.push(headers.map(h => String(row[h] ?? '')).join(delimiter));
    return lines.join('\n');
  }
  return data.map(row => (Array.isArray(row) ? row : [row]).join(delimiter)).join('\n');
}
