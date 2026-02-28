/**
 * Merge Coordinator — coordinate merges from agent worktrees back to main.
 */

import { randomUUID } from 'node:crypto';

/**
 * Create a merge coordinator.
 *
 * @returns {object} Coordinator with requestMerge/approveMerge/rejectMerge/getQueue/detectConflicts
 */
export function createMergeCoordinator() {
  const requests = new Map(); // id → merge request

  function requestMerge({ sourceBranch, targetBranch, agentId, files = [] }) {
    const id = randomUUID().slice(0, 12);
    const req = {
      id,
      sourceBranch,
      targetBranch,
      agentId,
      files,
      status: 'pending',
      approvedBy: null,
      rejectedBy: null,
      reason: null,
      createdAt: new Date().toISOString(),
    };
    requests.set(id, req);
    return req;
  }

  function approveMerge(id, { by } = {}) {
    const req = requests.get(id);
    if (!req) throw new Error(`Merge request ${id} not found`);
    req.status = 'approved';
    req.approvedBy = by;
    return req;
  }

  function rejectMerge(id, { by, reason } = {}) {
    const req = requests.get(id);
    if (!req) throw new Error(`Merge request ${id} not found`);
    req.status = 'rejected';
    req.rejectedBy = by;
    req.reason = reason;
    return req;
  }

  function getQueue() {
    return Array.from(requests.values()).filter(r => r.status === 'pending');
  }

  function detectConflicts(requestId) {
    const req = requests.get(requestId);
    if (!req) return [];

    const conflicts = [];
    for (const [otherId, other] of requests) {
      if (otherId === requestId) continue;
      if (other.status === 'rejected') continue;
      if (other.targetBranch !== req.targetBranch) continue;

      const overlapping = req.files.filter(f => other.files.includes(f));
      for (const file of overlapping) {
        conflicts.push({ file, conflictsWith: otherId, agentId: other.agentId });
      }
    }
    return conflicts;
  }

  return { requestMerge, approveMerge, rejectMerge, getQueue, detectConflicts };
}
