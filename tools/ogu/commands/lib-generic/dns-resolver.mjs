/**
 * DNS Resolver Mock — simulated DNS resolution.
 */
export function createDnsResolver() {
  const records = new Map();

  function addRecord(domain, ip) {
    records.set(domain, ip);
  }

  function resolve(domain) {
    return records.get(domain) || null;
  }

  function removeRecord(domain) {
    records.delete(domain);
  }

  function listRecords() {
    return [...records.entries()].map(([domain, ip]) => ({ domain, ip }));
  }

  return { addRecord, resolve, removeRecord, listRecords };
}
