/**
 * Interrupt Controller — register, mask, and trigger hardware interrupts.
 */
export function createInterruptController() {
  const handlers = new Map();
  const masked = new Set();
  function register(irq, handler) { handlers.set(irq, handler); }
  function mask(irq) { masked.add(irq); }
  function unmask(irq) { masked.delete(irq); }
  function trigger(irq) {
    if (masked.has(irq)) return false;
    const h = handlers.get(irq);
    if (h) { h(); return true; }
    return false;
  }
  function listIRQs() { return [...handlers.keys()]; }
  return { register, mask, unmask, trigger, listIRQs };
}
