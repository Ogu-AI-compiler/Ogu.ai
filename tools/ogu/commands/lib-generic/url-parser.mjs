/**
 * URL Parser — parse URLs into components.
 */
export function parseURL(url) {
  const re = /^(https?):\/\/([^/:]+)(?::(\d+))?(\/[^?#]*)?\??([^#]*)?(#.*)?$/;
  const m = url.match(re);
  if (!m) return null;
  const query = {};
  if (m[5]) {
    for (const pair of m[5].split('&')) {
      const [k, v] = pair.split('=');
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }
  return { protocol: m[1], host: m[2], port: m[3] ? Number(m[3]) : null, path: m[4] || '/', query, hash: m[6] || '' };
}
