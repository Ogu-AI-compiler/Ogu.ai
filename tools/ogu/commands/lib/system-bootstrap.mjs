/**
 * system-bootstrap.mjs — Dependency-ordered subsystem initializer.
 */
export function createBootstrap() {
  const registry = new Map();
  let booted = false;

  return {
    register(name, { init, deps = [] } = {}) {
      registry.set(name, { init, deps, status: 'pending' });
    },

    async boot() {
      const visited = new Set();
      const inProgress = new Set();

      const initOne = async (name) => {
        if (visited.has(name)) return;
        if (inProgress.has(name)) return;
        const entry = registry.get(name);
        if (!entry) return;
        inProgress.add(name);
        for (const dep of entry.deps) await initOne(dep);
        try {
          await entry.init?.();
          entry.status = 'ready';
        } catch (err) {
          entry.status = 'failed';
          entry.error = err.message;
        }
        inProgress.delete(name);
        visited.add(name);
      };

      for (const name of registry.keys()) await initOne(name);
      booted = true;
    },

    getStatus() {
      const statuses = {};
      for (const [name, entry] of registry) statuses[name] = entry.status;
      return { booted, subsystems: statuses };
    },
  };
}
