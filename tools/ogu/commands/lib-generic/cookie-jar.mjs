/**
 * Cookie Jar — manage HTTP cookies.
 */
export function createCookieJar() {
  const cookies = new Map();
  function set(name, value, options = {}) {
    cookies.set(name, { value, ...options, createdAt: Date.now() });
  }
  function get(name) { const c = cookies.get(name); return c ? c.value : null; }
  function remove(name) { cookies.delete(name); }
  function has(name) { return cookies.has(name); }
  function serialize() {
    return [...cookies.entries()].map(([k, v]) => `${k}=${v.value}`).join('; ');
  }
  function parse(cookieStr) {
    for (const pair of cookieStr.split(';')) {
      const [k, v] = pair.trim().split('=');
      if (k) set(k.trim(), (v || '').trim());
    }
  }
  function list() { return [...cookies.keys()]; }
  return { set, get, remove, has, serialize, parse, list };
}
