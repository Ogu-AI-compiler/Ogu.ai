/**
 * Clock Divider — divides input clock frequency.
 */
export function createClockDivider({ inputFreq, divisor }) {
  let counter = 0;
  const listeners = [];
  function getOutputFreq() { return inputFreq / divisor; }
  function onTick(fn) { listeners.push(fn); }
  function tick() {
    counter++;
    if (counter >= divisor) {
      counter = 0;
      for (const fn of listeners) fn();
    }
  }
  function reset() { counter = 0; }
  return { getOutputFreq, onTick, tick, reset };
}
