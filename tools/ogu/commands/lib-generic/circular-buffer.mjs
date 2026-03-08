/**
 * Circular Buffer — auto-resizing circular buffer.
 */

/**
 * @param {{ initialCapacity?: number }} opts
 */
export function createCircularBuffer({ initialCapacity = 8 } = {}) {
  let buf = new Array(initialCapacity);
  let capacity = initialCapacity;
  let head = 0;
  let count = 0;

  function grow() {
    const newCap = capacity * 2;
    const newBuf = new Array(newCap);
    for (let i = 0; i < count; i++) {
      newBuf[i] = buf[(head + i) % capacity];
    }
    buf = newBuf;
    head = 0;
    capacity = newCap;
  }

  function push(item) {
    if (count === capacity) grow();
    const tail = (head + count) % capacity;
    buf[tail] = item;
    count++;
  }

  function shift() {
    if (count === 0) return undefined;
    const item = buf[head];
    head = (head + 1) % capacity;
    count--;
    return item;
  }

  function size() {
    return count;
  }

  function getCapacity() {
    return capacity;
  }

  return { push, shift, size, getCapacity };
}
