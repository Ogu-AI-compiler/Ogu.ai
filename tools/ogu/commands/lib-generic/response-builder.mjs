/**
 * Response Builder — build HTTP response objects.
 */
export function createResponseBuilder() {
  const res = { status: 200, headers: {}, body: null };
  function status(code) { res.status = code; return api; }
  function header(k, v) { res.headers[k] = v; return api; }
  function json(data) { res.body = JSON.stringify(data); res.headers['Content-Type'] = 'application/json'; return api; }
  function text(data) { res.body = data; res.headers['Content-Type'] = 'text/plain'; return api; }
  function html(data) { res.body = data; res.headers['Content-Type'] = 'text/html'; return api; }
  function build() { return { ...res, headers: { ...res.headers } }; }
  const api = { status, header, json, text, html, build };
  return api;
}
