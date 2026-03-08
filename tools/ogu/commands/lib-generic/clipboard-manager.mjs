/**
 * Clipboard Manager — multi-slot clipboard with history.
 */
export function createClipboardManager() {
  const slots = new Map();
  const history = [];
  function copy(data, slot = 'default') {
    slots.set(slot, data);
    history.push({ action: 'copy', data, slot, time: Date.now() });
  }
  function paste(slot = 'default') {
    return slots.get(slot) || null;
  }
  function clear(slot = 'default') { slots.delete(slot); }
  function clearAll() { slots.clear(); }
  function listSlots() { return [...slots.keys()]; }
  function getHistory() { return [...history]; }
  return { copy, paste, clear, clearAll, listSlots, getHistory };
}
