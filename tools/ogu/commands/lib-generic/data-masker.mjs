/**
 * Data Masker — mask sensitive fields in data objects.
 */
export function createDataMasker() {
  const sensitiveFields = new Set();
  let maskChar = '*';
  function addField(field) { sensitiveFields.add(field); }
  function removeField(field) { sensitiveFields.delete(field); }
  function setMaskChar(ch) { maskChar = ch; }
  function mask(obj) {
    const result = { ...obj };
    for (const field of sensitiveFields) {
      if (field in result) {
        const val = String(result[field]);
        result[field] = maskChar.repeat(val.length);
      }
    }
    return result;
  }
  function listFields() { return [...sensitiveFields]; }
  return { addField, removeField, setMaskChar, mask, listFields };
}
