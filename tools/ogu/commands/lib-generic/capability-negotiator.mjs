/**
 * Capability Negotiator — negotiate capabilities between peers.
 */

export function negotiate(offered, required) {
  return offered.filter(cap => required.includes(cap));
}

export function negotiateWithPriority(clientCaps, serverCaps) {
  const serverMap = new Map(serverCaps.map(c => [c.name, c]));
  const common = clientCaps
    .filter(c => serverMap.has(c.name))
    .map(c => ({ name: c.name, priority: Math.max(c.priority, serverMap.get(c.name).priority) }))
    .sort((a, b) => b.priority - a.priority);
  return common[0] || null;
}

export function isCompatible(offered, required) {
  return required.every(cap => offered.includes(cap));
}
