/**
 * Route Pipeline — middleware pipeline for route handling.
 */
export function createRoutePipeline() {
  const middleware = [];
  function use(fn) { middleware.push(fn); }
  function execute(ctx) {
    let idx = 0;
    function next() {
      if (idx >= middleware.length) return;
      const mw = middleware[idx++];
      mw(ctx, next);
    }
    next();
    return ctx;
  }
  function count() { return middleware.length; }
  function clear() { middleware.length = 0; }
  return { use, execute, count, clear };
}
