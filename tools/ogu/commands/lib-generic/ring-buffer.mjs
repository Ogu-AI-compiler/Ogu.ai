/**
 * Ring Buffer — fixed-size circular buffer with O(1) wraparound.
 */

/**
 * @param {number} capacity
 */
export function createRingBuffer(capacity) {
  const buf = new Array(capacity);
  let head = 0;   // read position
  let tail = 0;   // write position
  let count = 0;

  function push(item) {
    buf[tail] = item;
    tail = (tail + 1) % capacity;
    if (count < capacity) {
      count++;
    } else {
      head = (head + 1) % capacity; // overwrite oldest
    }
  }

  function read() {
    if (count === 0) return undefined;
    const item = buf[head];
    head = (head + 1) % capacity;
    count--;
    return item;
  }

  function size() {
    return count;
  }

  function toArray() {
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(buf[(head + i) % capacity]);
    }
    return result;
  }

  return { push, read, size, toArray };
}
