/**
 * Middleware Chain Executor — execute middleware pipeline with early exit.
 */

export function createMiddlewareChain() {
  const middlewares = [];

  function use(fn) {
    middlewares.push(fn);
  }

  function execute(ctx) {
    let index = 0;

    function next() {
      if (index >= middlewares.length) return;
      const fn = middlewares[index++];
      fn(ctx, next);
    }

    next();
  }

  return { use, execute };
}
