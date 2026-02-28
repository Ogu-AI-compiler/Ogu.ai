/**
 * Middleware Pipeline — composable middleware chain (like Express/Koa).
 */

/**
 * Create a middleware pipeline.
 *
 * @returns {object} Pipeline with use/execute
 */
export function createPipeline() {
  const middlewares = [];

  function use(fn) {
    middlewares.push(fn);
  }

  async function execute(ctx) {
    let index = 0;

    async function next() {
      if (index >= middlewares.length) return;
      const fn = middlewares[index++];
      await fn(ctx, next);
    }

    await next();
  }

  return { use, execute };
}
