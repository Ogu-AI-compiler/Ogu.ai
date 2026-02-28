/**
 * Artifact Handoff — pass artifacts between agents with validation.
 */

import { randomUUID } from 'node:crypto';

/**
 * Create an artifact handoff manager.
 *
 * @returns {object} Manager with send/receive/listPending/getHistory
 */
export function createArtifactHandoff() {
  const handoffs = new Map(); // id → envelope

  function send({ from, to, artifact, message }) {
    const id = randomUUID().slice(0, 12);
    handoffs.set(id, {
      id,
      from,
      to,
      artifact,
      message,
      status: 'pending',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      rejection: null,
    });
    return id;
  }

  function receive(id, { accepted, reason } = {}) {
    const envelope = handoffs.get(id);
    if (!envelope) throw new Error(`Handoff ${id} not found`);

    envelope.status = accepted ? 'accepted' : 'rejected';
    envelope.resolvedAt = new Date().toISOString();
    if (!accepted && reason) {
      envelope.rejection = reason;
    }
    return envelope;
  }

  function listPending(agentId) {
    return Array.from(handoffs.values())
      .filter(h => h.to === agentId && h.status === 'pending');
  }

  function getHistory() {
    return Array.from(handoffs.values());
  }

  return { send, receive, listPending, getHistory };
}
