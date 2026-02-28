/**
 * Formal Scheduler — priority-based scheduling with starvation prevention.
 *
 * Features:
 *   - Priority classes (critical, high, normal, low)
 *   - Weighted Fair Queuing (WFQ)
 *   - Starvation prevention for low-priority tasks
 *   - FIFO within same priority
 */

export const PRIORITY_CLASSES = {
  critical: { level: 3, weight: 8, description: 'Urgent, blocks everything' },
  high:     { level: 2, weight: 4, description: 'Important, should run soon' },
  normal:   { level: 1, weight: 2, description: 'Standard priority' },
  low:      { level: 0, weight: 1, description: 'Background, can wait' },
};

/**
 * Create a priority scheduler instance.
 *
 * @param {object} [opts]
 * @param {number} [opts.starvationThreshold] - Number of dequeue cycles before promoting starved tasks
 * @returns {{ enqueue, dequeue, size, peek, checkStarvation }}
 */
export function createScheduler({ starvationThreshold = 10 } = {}) {
  const queue = [];
  let dequeueCount = 0;

  return {
    /**
     * Add a task to the queue.
     */
    enqueue(item) {
      const entry = {
        ...item,
        priority: item.priority || 'normal',
        enqueuedAt: item.enqueuedAt || Date.now(),
        promotedFrom: null,
      };
      queue.push(entry);
    },

    /**
     * Remove and return the highest-priority task.
     * Within same priority, FIFO order.
     */
    dequeue() {
      if (queue.length === 0) return null;
      dequeueCount++;

      // Sort by priority level (desc), then by enqueue time (asc)
      queue.sort((a, b) => {
        const pa = PRIORITY_CLASSES[a.priority]?.level ?? 1;
        const pb = PRIORITY_CLASSES[b.priority]?.level ?? 1;
        if (pa !== pb) return pb - pa;
        return a.enqueuedAt - b.enqueuedAt;
      });

      return queue.shift();
    },

    /**
     * Peek at the next task without removing it.
     */
    peek() {
      if (queue.length === 0) return null;
      queue.sort((a, b) => {
        const pa = PRIORITY_CLASSES[a.priority]?.level ?? 1;
        const pb = PRIORITY_CLASSES[b.priority]?.level ?? 1;
        if (pa !== pb) return pb - pa;
        return a.enqueuedAt - b.enqueuedAt;
      });
      return queue[0];
    },

    /**
     * Get queue size.
     */
    size() {
      return queue.length;
    },

    /**
     * Check for starved tasks and promote them.
     * A task is starved if it's been waiting longer than starvationThreshold dequeue cycles.
     */
    checkStarvation() {
      const now = Date.now();
      for (const item of queue) {
        const waitTime = now - item.enqueuedAt;
        // If waiting more than threshold * 1000ms, promote
        if (waitTime > starvationThreshold * 1000 && item.priority === 'low') {
          item.promotedFrom = item.priority;
          item.priority = 'high';
        } else if (waitTime > starvationThreshold * 2000 && item.priority === 'normal') {
          item.promotedFrom = item.priority;
          item.priority = 'critical';
        }
      }
    },
  };
}

/**
 * Compute Weighted Fair Queuing weights based on queue composition.
 *
 * @param {object} counts - { critical: N, high: N, normal: N, low: N }
 * @returns {object} Per-class weight allocation
 */
export function computeWFQWeights(counts) {
  const totalWeight = Object.entries(counts).reduce((sum, [cls, count]) => {
    return sum + count * (PRIORITY_CLASSES[cls]?.weight || 1);
  }, 0);

  const weights = {};
  for (const [cls, count] of Object.entries(counts)) {
    const classWeight = PRIORITY_CLASSES[cls]?.weight || 1;
    weights[cls] = totalWeight > 0
      ? (count * classWeight) / totalWeight
      : 0;
  }

  return weights;
}
