/**
 * Request Builder — build HTTP request objects.
 */
export function createRequestBuilder() {
  const req = { method: 'GET', url: '/', headers: {}, body: null, query: {} };
  function method(m) { req.method = m.toUpperCase(); return api; }
  function url(u) { req.url = u; return api; }
  function header(k, v) { req.headers[k] = v; return api; }
  function body(b) { req.body = b; return api; }
  function query(k, v) { req.query[k] = v; return api; }
  function build() { return { ...req, headers: { ...req.headers }, query: { ...req.query } }; }
  const api = { method, url, header, body, query, build };
  return api;
}
