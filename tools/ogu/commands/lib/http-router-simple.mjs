/**
 * HTTP Router Simple — simple path-based HTTP router.
 */
export function createHTTPRouter() {
  const routes = [];
  function add(method, path, handler) { routes.push({ method: method.toUpperCase(), path, handler }); }
  function get(path, handler) { add('GET', path, handler); }
  function post(path, handler) { add('POST', path, handler); }
  function put(path, handler) { add('PUT', path, handler); }
  function del(path, handler) { add('DELETE', path, handler); }
  function match(method, path) {
    return routes.find(r => r.method === method.toUpperCase() && r.path === path) || null;
  }
  function dispatch(method, path, ctx = {}) {
    const route = match(method, path);
    if (!route) return { status: 404, body: 'Not Found' };
    return route.handler(ctx);
  }
  function listRoutes() { return routes.map(r => `${r.method} ${r.path}`); }
  return { add, get, post, put, del, match, dispatch, listRoutes };
}
