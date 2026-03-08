/**
 * Approval Enforcer — runtime enforcement of approval gates.
 *
 * Creates approval gates that block operations until approved by
 * an authorized role. Supports approve, deny, and check workflows.
 */

let nextId = 1;

/**
 * Create an approval enforcer.
 *
 * @returns {object} Enforcer with requireApproval/approve/deny/checkApproval
 */
export function createApprovalEnforcer() {
  const gates = new Map();

  function requireApproval({ operation, requiredRole, agentId }) {
    const id = `gate-${nextId++}`;
    const gate = {
      id,
      operation,
      requiredRole,
      agentId,
      status: 'pending',
      createdAt: Date.now(),
    };
    gates.set(id, gate);
    return gate;
  }

  function approve(gateId, { approvedBy, reason }) {
    const gate = gates.get(gateId);
    if (!gate) throw new Error(`Gate ${gateId} not found`);
    if (gate.status !== 'pending') throw new Error(`Gate ${gateId} is ${gate.status}, cannot approve`);
    gate.status = 'approved';
    gate.approvedBy = approvedBy;
    gate.approvalReason = reason;
    gate.resolvedAt = Date.now();
    return gate;
  }

  function deny(gateId, { deniedBy, reason }) {
    const gate = gates.get(gateId);
    if (!gate) throw new Error(`Gate ${gateId} not found`);
    if (gate.status !== 'pending') throw new Error(`Gate ${gateId} is ${gate.status}, cannot deny`);
    gate.status = 'denied';
    gate.deniedBy = deniedBy;
    gate.denialReason = reason;
    gate.resolvedAt = Date.now();
    return gate;
  }

  function checkApproval(gateId) {
    const gate = gates.get(gateId);
    if (!gate) return false;
    return gate.status === 'approved';
  }

  function getGate(gateId) {
    return gates.get(gateId) || null;
  }

  return { requireApproval, approve, deny, checkApproval, getGate };
}
