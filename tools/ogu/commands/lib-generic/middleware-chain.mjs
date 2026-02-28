/**
 * Middleware Chain — Express-style middleware pipeline.
 */
export function createMiddlewareChain() {
  const middlewares = [];
  function use(fn) { middlewares.push(fn); }
  function execute(ctx) {
    let index = 0;
    function next() {
      if (index >= middlewares.length) return;
      const mw = middlewares[index++];
      mw(ctx, next);
    }
    next();
  }
  return { use, execute };
}
