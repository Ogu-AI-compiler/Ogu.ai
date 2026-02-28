/**
 * Deadline Tracker — track and alert on approaching deadlines.
 */

/**
 * Create a deadline tracker.
 *
 * @returns {object} Tracker with addDeadline/removeDeadline/check/listDeadlines
 */
export function createDeadlineTracker() {
  const deadlines = new Map();

  function addDeadline({ id, deadline, label = '' }) {
    deadlines.set(id, { id, deadline, label });
  }

  function removeDeadline(id) {
    deadlines.delete(id);
  }

  function check({ warningThresholdMs = 3600000 } = {}) {
    const now = Date.now();
    const overdue = [];
    const approaching = [];
    const ok = [];

    for (const d of deadlines.values()) {
      const remaining = d.deadline - now;
      if (remaining < 0) {
        overdue.push({ ...d, overdueMs: -remaining });
      } else if (remaining < warningThresholdMs) {
        approaching.push({ ...d, remainingMs: remaining });
      } else {
        ok.push({ ...d, remainingMs: remaining });
      }
    }

    return { overdue, approaching, ok };
  }

  function listDeadlines() {
    return Array.from(deadlines.values());
  }

  function markComplete(id) {
    const d = deadlines.get(id);
    if (d) d.completed = true;
  }

  function checkDeadlines({ warningThreshold = 300000 } = {}) {
    const now = Date.now();
    const active = Array.from(deadlines.values()).filter(d => !d.completed);
    const missed = active.filter(d => (d.dueAt || d.deadline) < now);
    const approaching = active.filter(d => {
      const due = d.dueAt || d.deadline;
      return due >= now && due - now < warningThreshold;
    });
    const upcoming = active.filter(d => (d.dueAt || d.deadline) >= now);
    return { missed, approaching, upcoming };
  }

  // Extended addDeadline that accepts dueAt + taskId
  const origAdd = addDeadline;
  function addDeadlineExt(opts) {
    if (opts.dueAt) {
      deadlines.set(opts.id, { ...opts, completed: false });
    } else {
      origAdd(opts);
    }
  }

  return { addDeadline: addDeadlineExt, removeDeadline, check, listDeadlines, markComplete, checkDeadlines };
}
