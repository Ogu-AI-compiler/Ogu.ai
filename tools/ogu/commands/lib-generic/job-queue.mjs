/**
 * Job Queue — deterministic job scheduling with retry support.
 */

import { randomUUID } from 'node:crypto';

/**
 * Create a FIFO job queue with retry and completion tracking.
 *
 * @returns {object} Queue with enqueue/dequeue/markCompleted/retry/getStats
 */
export function createJobQueue() {
  const pending = [];   // jobs waiting
  const active = new Map();   // id → job (dequeued, not yet completed)
  let completedCount = 0;

  function enqueue(payload) {
    const id = randomUUID().slice(0, 8);
    const job = {
      id,
      ...payload,
      retryCount: payload.retryCount || 0,
      enqueuedAt: new Date().toISOString(),
    };
    pending.push(job);
    return id;
  }

  function dequeue() {
    if (pending.length === 0) return null;
    const job = pending.shift();
    active.set(job.id, job);
    return job;
  }

  function markCompleted(id) {
    active.delete(id);
    completedCount++;
  }

  function retry(id) {
    const job = active.get(id);
    if (!job) return;
    active.delete(id);
    job.retryCount = (job.retryCount || 0) + 1;
    pending.push(job);
  }

  function getStats() {
    return {
      pending: pending.length,
      active: active.size,
      completed: completedCount,
    };
  }

  return { enqueue, dequeue, markCompleted, retry, getStats };
}
