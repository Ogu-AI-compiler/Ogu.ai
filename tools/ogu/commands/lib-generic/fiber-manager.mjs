/**
 * Fiber Manager — manage lightweight execution units (fibers).
 */
export function createFiberManager() {
  const fibers = new Map();

  function create(name, fn) {
    fibers.set(name, { name, fn, status: "pending" });
  }

  function runAll() {
    for (const [name, fiber] of fibers) {
      fiber.status = "running";
      fiber.fn();
      fiber.status = "completed";
    }
  }

  function list() {
    return [...fibers.values()];
  }

  function getStats() {
    return { total: fibers.size };
  }

  return { create, runAll, list, getStats };
}
