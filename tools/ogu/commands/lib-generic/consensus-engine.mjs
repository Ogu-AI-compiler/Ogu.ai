/**
 * Consensus Engine — simple majority-based consensus.
 */
export function createConsensusEngine(nodes) {
  const votes = new Map();
  function propose(proposalId, value) {
    votes.set(proposalId, { value, accepts: new Set(), rejects: new Set() });
  }
  function vote(proposalId, nodeId, accept) {
    const prop = votes.get(proposalId);
    if (!prop) throw new Error(`Proposal ${proposalId} not found`);
    if (accept) prop.accepts.add(nodeId); else prop.rejects.add(nodeId);
  }
  function isAccepted(proposalId) {
    const prop = votes.get(proposalId);
    if (!prop) return false;
    return prop.accepts.size > nodes.length / 2;
  }
  function getStatus(proposalId) {
    const prop = votes.get(proposalId);
    if (!prop) return null;
    return { value: prop.value, accepts: prop.accepts.size, rejects: prop.rejects.size, total: nodes.length };
  }
  function listProposals() { return [...votes.keys()]; }
  return { propose, vote, isAccepted, getStatus, listProposals };
}
