/**
 * Approval Lifecycle — formal state machine for approval records.
 *
 * States: pending → approved | denied | escalated | timed_out
 */

import { randomUUID } from 'node:crypto';

export const APPROVAL_STATES = ['pending', 'approved', 'denied', 'escalated', 'timed_out'];

const TERMINAL_STATES = new Set(['approved', 'denied', 'timed_out']);

/**
 * Create an approval lifecycle manager.
 *
 * @returns {object} Manager with create/approve/deny/escalate/timeout/get/listPending
 */
export function createApprovalLifecycle() {
  const approvals = new Map(); // id → record

  function create({ requestor, approver, action, context }) {
    const id = randomUUID().slice(0, 12);
    const record = {
      id,
      requestor,
      approver,
      action,
      context,
      status: 'pending',
      reason: null,
      escalatedTo: null,
      decidedBy: null,
      notes: null,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    approvals.set(id, record);
    return record;
  }

  function assertTransitionable(id) {
    const record = approvals.get(id);
    if (!record) throw new Error(`Approval ${id} not found`);
    if (TERMINAL_STATES.has(record.status)) {
      throw new Error(`Cannot transition from terminal state: ${record.status}`);
    }
    return record;
  }

  function approve(id, { by, notes } = {}) {
    const record = assertTransitionable(id);
    record.status = 'approved';
    record.decidedBy = by || null;
    record.notes = notes || null;
    record.resolvedAt = new Date().toISOString();
    return record;
  }

  function deny(id, { by, reason } = {}) {
    const record = assertTransitionable(id);
    record.status = 'denied';
    record.decidedBy = by || null;
    record.reason = reason || null;
    record.resolvedAt = new Date().toISOString();
    return record;
  }

  function escalate(id, { to, reason } = {}) {
    const record = assertTransitionable(id);
    record.status = 'escalated';
    record.escalatedTo = to;
    record.reason = reason || null;
    record.resolvedAt = new Date().toISOString();
    return record;
  }

  function timeout(id) {
    const record = assertTransitionable(id);
    record.status = 'timed_out';
    record.resolvedAt = new Date().toISOString();
    return record;
  }

  function get(id) {
    return approvals.get(id) || null;
  }

  function listPending() {
    return Array.from(approvals.values()).filter(a => a.status === 'pending');
  }

  return { create, approve, deny, escalate, timeout, get, listPending };
}
