/**
 * Schema Migration Planner — plan schema changes with forward/backward steps.
 */

/**
 * Create a migration planner.
 *
 * @returns {object} Planner with addMigration/plan/listMigrations
 */
export function createMigrationPlanner() {
  const migrations = [];

  function addMigration({ version, description, up, down }) {
    migrations.push({ version, description, up, down });
    migrations.sort((a, b) => a.version - b.version);
  }

  function plan({ from, to }) {
    const steps = [];
    if (to > from) {
      // Forward migration
      const applicable = migrations.filter(m => m.version > from && m.version <= to);
      for (const m of applicable) {
        steps.push({ version: m.version, direction: 'up', description: m.description, execute: m.up });
      }
    } else if (to < from) {
      // Backward migration
      const applicable = migrations
        .filter(m => m.version <= from && m.version > to)
        .reverse();
      for (const m of applicable) {
        steps.push({ version: m.version, direction: 'down', description: m.description, execute: m.down });
      }
    }
    return steps;
  }

  function listMigrations() {
    return [...migrations];
  }

  return { addMigration, plan, listMigrations };
}
