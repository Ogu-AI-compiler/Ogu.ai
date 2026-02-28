/**
 * Scheduled Task Manager — manage cron-scheduled tasks.
 */
import { matches } from "./cron-expression-parser.mjs";

export function createScheduledTaskManager() {
  const tasks = new Map();

  function schedule(name, cronExpr, fn) {
    tasks.set(name, { name, cronExpr, fn });
  }

  function cancel(name) {
    tasks.delete(name);
  }

  function list() {
    return [...tasks.values()].map(t => ({ name: t.name, cronExpr: t.cronExpr }));
  }

  function getDue(date) {
    return [...tasks.values()].filter(t => matches(t.cronExpr, date));
  }

  function getStats() {
    return { total: tasks.size };
  }

  return { schedule, cancel, list, getDue, getStats };
}
