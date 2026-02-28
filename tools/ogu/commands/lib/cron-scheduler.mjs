/**
 * Cron Scheduler — schedule recurring tasks with cron expressions.
 */

/**
 * Parse a cron expression (minute hour dom month dow).
 *
 * @param {string} expr - Cron expression
 * @returns {{ minute: number|'*', hour: number|'*', dom: string, month: string, dow: string }}
 */
export function parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return null;

  return {
    minute: parts[0] === '*' ? '*' : parseInt(parts[0]),
    hour: parts[1] === '*' ? '*' : parseInt(parts[1]),
    dom: parts[2],
    month: parts[3],
    dow: parts[4],
  };
}

/**
 * Create a scheduler instance.
 * @returns {object} Scheduler with addJob/removeJob/listJobs/getNextRun
 */
export function createScheduler() {
  const jobs = new Map();

  function addJob({ id, schedule, task }) {
    const parsed = parseCron(schedule);
    jobs.set(id, { id, schedule, task, parsed, createdAt: Date.now() });
  }

  function removeJob(id) {
    jobs.delete(id);
  }

  function listJobs() {
    return [...jobs.values()].map(j => ({
      id: j.id,
      schedule: j.schedule,
      task: j.task,
    }));
  }

  function getNextRun(jobId) {
    const job = jobs.get(jobId);
    if (!job || !job.parsed) return null;

    const now = new Date();
    const next = new Date(now);

    // Simple next-run calculation
    const { minute, hour } = job.parsed;

    if (minute !== '*') next.setMinutes(minute);
    if (hour !== '*') next.setHours(hour);
    next.setSeconds(0);
    next.setMilliseconds(0);

    // If next is in the past, move to next day
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  return { addJob, removeJob, listJobs, getNextRun };
}
