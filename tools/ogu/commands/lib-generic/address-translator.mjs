/**
 * Address Translator — translates virtual addresses to physical using page table.
 */
export function createAddressTranslator({ pageSize }) {
  const pageTable = new Map();
  function mapPage(virtualPage, physicalFrame) { pageTable.set(virtualPage, physicalFrame); }
  function translate(virtualAddr) {
    const page = Math.floor(virtualAddr / pageSize);
    const offset = virtualAddr % pageSize;
    if (!pageTable.has(page)) return null;
    return { frame: pageTable.get(page), offset, physicalAddr: pageTable.get(page) * pageSize + offset };
  }
  function unmapPage(virtualPage) { pageTable.delete(virtualPage); }
  return { mapPage, translate, unmapPage };
}
