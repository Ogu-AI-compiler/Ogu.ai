/**
 * API Gateway — central request router with health aggregation.
 */

/**
 * Create an API gateway.
 *
 * @returns {object} Gateway with addRoute/handle/listRoutes/getHealth
 */
export function createGateway() {
  const routes = []; // { method, path, handler }

  function addRoute(method, path, handler) {
    routes.push({ method: method.toUpperCase(), path, handler });
  }

  async function handle({ method, path, body } = {}) {
    const route = routes.find(r => r.method === method.toUpperCase() && r.path === path);
    if (!route) {
      return { status: 404, error: 'Not Found' };
    }
    try {
      const result = await route.handler({ method, path, body });
      return result;
    } catch (e) {
      return { status: 500, error: e.message };
    }
  }

  function listRoutes() {
    return routes.map(r => ({ method: r.method, path: r.path }));
  }

  function getHealth() {
    return {
      status: 'healthy',
      routeCount: routes.length,
      timestamp: new Date().toISOString(),
    };
  }

  return { addRoute, handle, listRoutes, getHealth };
}
