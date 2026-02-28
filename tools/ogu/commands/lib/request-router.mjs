/**
 * Request Router — route requests to handlers by method and pattern.
 */

export function createRouter() {
  const routes = [];

  function addRoute(method, pattern, handler) {
    routes.push({ method: method.toUpperCase(), pattern, handler });
  }

  function route(method, path, request) {
    method = method.toUpperCase();

    for (const r of routes) {
      if (r.method !== method) continue;

      const params = matchPattern(r.pattern, path);
      if (params !== null) {
        const result = r.handler(request, params);
        return result !== undefined ? result : { status: 200 };
      }
    }

    return { status: 404, message: "Not found" };
  }

  function matchPattern(pattern, path) {
    const patternParts = pattern.split("/");
    const pathParts = path.split("/");

    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }

    return params;
  }

  return { addRoute, route };
}
