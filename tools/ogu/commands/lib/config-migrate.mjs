/**
 * Config Migration Engine — version-aware config migration with transforms.
 *
 * Registers migration steps between versions and applies them in order.
 */

/**
 * Create a migration engine instance.
 *
 * @returns {object} Engine with register/migrate/getVersion/getVersions
 */
export function createMigrationEngine() {
  const migrations = []; // { from, to, transform }

  function register(from, to, transform) {
    migrations.push({ from, to, transform });
  }

  function getVersions() {
    return migrations.map(m => ({ from: m.from, to: m.to }));
  }

  function getVersion(config) {
    return config._version || '0.0';
  }

  function migrate(config, targetVersion) {
    let current = { ...config };
    let currentVersion = getVersion(current);
    const log = [];

    if (currentVersion === targetVersion) {
      return current;
    }

    // Build migration chain from current to target
    let safety = 0;
    while (currentVersion !== targetVersion && safety < 100) {
      const step = migrations.find(m => m.from === currentVersion);
      if (!step) break;

      current = step.transform(current);
      current._version = step.to;
      log.push(`${step.from} → ${step.to}`);
      currentVersion = step.to;
      safety++;
    }

    current._migrations = log;
    return current;
  }

  return { register, migrate, getVersion, getVersions };
}
