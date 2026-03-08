/**
 * Proposal Manager — create, apply, and rollback proposals.
 */

import { randomUUID } from 'node:crypto';

export const PROPOSAL_STATUSES = ['pending', 'applied', 'rolled_back', 'rejected'];

/**
 * Create a proposal manager.
 *
 * @param {{ root: string }} opts
 * @returns {object} Manager with createProposal/applyProposal/rollbackProposal/getProposal/listProposals
 */
export function createProposalManager({ root } = {}) {
  const proposals = new Map();

  function createProposal({ title, changes = [], description = '' }) {
    const id = randomUUID().slice(0, 8);
    const proposal = {
      id,
      title,
      description,
      changes,
      status: 'pending',
      createdAt: new Date().toISOString(),
      appliedAt: null,
      rolledBackAt: null,
    };
    proposals.set(id, proposal);
    return id;
  }

  function getProposal(id) {
    return proposals.get(id) || null;
  }

  function applyProposal(id) {
    const p = proposals.get(id);
    if (!p) throw new Error(`Proposal ${id} not found`);
    if (p.status === 'applied') return;
    p.status = 'applied';
    p.appliedAt = new Date().toISOString();
  }

  function rollbackProposal(id) {
    const p = proposals.get(id);
    if (!p) throw new Error(`Proposal ${id} not found`);
    p.status = 'rolled_back';
    p.rolledBackAt = new Date().toISOString();
  }

  function listProposals() {
    return Array.from(proposals.values());
  }

  return { createProposal, getProposal, applyProposal, rollbackProposal, listProposals };
}
