/**
 * Capability Checker — capability-based access control.
 */
export function createCapabilityChecker() {
  const capabilities = new Map();
  function grant(subject, capability) {
    if (!capabilities.has(subject)) capabilities.set(subject, new Set());
    capabilities.get(subject).add(capability);
  }
  function revoke(subject, capability) {
    const set = capabilities.get(subject);
    if (set) set.delete(capability);
  }
  function has(subject, capability) {
    const set = capabilities.get(subject);
    return set ? set.has(capability) : false;
  }
  function list(subject) { return [...(capabilities.get(subject) || [])]; }
  return { grant, revoke, has, list };
}
