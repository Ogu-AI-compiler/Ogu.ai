/**
 * Opcode Table — map between numeric opcodes and mnemonics.
 */
export function createOpcodeTable() {
  const byCode = new Map();
  const byName = new Map();
  function register(code, mnemonic, meta = {}) {
    const entry = { code, mnemonic, ...meta };
    byCode.set(code, entry);
    byName.set(mnemonic, entry);
  }
  function lookup(code) { return byCode.get(code) || null; }
  function lookupByName(name) { return byName.get(name) || null; }
  function list() { return [...byCode.values()]; }
  return { register, lookup, lookupByName, list };
}
