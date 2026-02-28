/**
 * System Bootstrap — initialize all subsystems in dependency order.
 */

/**
 * Create a system bootstrap manager.
 *
 * @returns {object} Bootstrap with register/boot/getStatus/listSystems
 */
export function createBootstrap() {
  const systems = new Map(); // name → { init, deps, booted }
  let state = 'idle';

  function register(name, { init, deps = [] }) {
    systems.set(name, { name, init, deps, booted: false });
  }

  function listSystems() {
    return Array.from(systems.keys());
  }

  async function boot() {
    state = 'booting';
    const booted = new Set();

    // Topological sort
    const order = [];
    const visited = new Set();

    function visit(name) {
      if (visited.has(name)) return;
      visited.add(name);
      const sys = systems.get(name);
      if (!sys) throw new Error(`Unknown subsystem: ${name}`);
      for (const dep of sys.deps) {
        visit(dep);
      }
      order.push(name);
    }

    for (const name of systems.keys()) {
      visit(name);
    }

    // Boot in order
    for (const name of order) {
      const sys = systems.get(name);
      try {
        await sys.init();
        sys.booted = true;
        booted.add(name);
      } catch (e) {
        state = 'failed';
        throw e;
      }
    }

    state = 'ready';
  }

  function getStatus() {
    let bootedCount = 0;
    for (const sys of systems.values()) {
      if (sys.booted) bootedCount++;
    }
    return {
      state,
      total: systems.size,
      booted: bootedCount,
    };
  }

  return { register, boot, getStatus, listSystems };
}
