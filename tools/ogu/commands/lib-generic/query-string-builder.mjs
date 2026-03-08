/**
 * Query String Builder — build URL query strings.
 */
export function buildQueryString(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export function parseQueryString(qs) {
  const result = {};
  const str = qs.startsWith('?') ? qs.slice(1) : qs;
  for (const pair of str.split('&')) {
    const [k, v] = pair.split('=');
    if (k) result[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return result;
}

export function appendParam(qs, key, value) {
  const sep = qs.includes('?') ? '&' : '?';
  return `${qs}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}
