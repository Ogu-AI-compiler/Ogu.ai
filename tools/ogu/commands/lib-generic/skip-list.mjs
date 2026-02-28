/**
 * Skip List — probabilistic sorted data structure with O(log n) search.
 */
export function createSkipList(maxLevel = 16) {
  const head = { value: -Infinity, next: new Array(maxLevel).fill(null) };
  let level = 0;
  let count = 0;

  function randomLevel() {
    let lvl = 0;
    while (lvl < maxLevel - 1 && Math.random() < 0.5) lvl++;
    return lvl;
  }

  function insert(value) {
    const update = new Array(maxLevel).fill(null);
    let curr = head;
    for (let i = level; i >= 0; i--) {
      while (curr.next[i] && curr.next[i].value < value) curr = curr.next[i];
      update[i] = curr;
    }
    const newLevel = randomLevel();
    if (newLevel > level) {
      for (let i = level + 1; i <= newLevel; i++) update[i] = head;
      level = newLevel;
    }
    const node = { value, next: new Array(newLevel + 1).fill(null) };
    for (let i = 0; i <= newLevel; i++) {
      node.next[i] = update[i].next[i];
      update[i].next[i] = node;
    }
    count++;
  }

  function search(value) {
    let curr = head;
    for (let i = level; i >= 0; i--) {
      while (curr.next[i] && curr.next[i].value < value) curr = curr.next[i];
    }
    curr = curr.next[0];
    return curr !== null && curr.value === value;
  }

  function remove(value) {
    const update = new Array(maxLevel).fill(null);
    let curr = head;
    for (let i = level; i >= 0; i--) {
      while (curr.next[i] && curr.next[i].value < value) curr = curr.next[i];
      update[i] = curr;
    }
    curr = curr.next[0];
    if (curr && curr.value === value) {
      for (let i = 0; i <= level; i++) {
        if (update[i].next[i] !== curr) break;
        update[i].next[i] = curr.next[i];
      }
      while (level > 0 && !head.next[level]) level--;
      count--;
    }
  }

  function toArray() {
    const result = [];
    let curr = head.next[0];
    while (curr) { result.push(curr.value); curr = curr.next[0]; }
    return result;
  }

  function size() { return count; }

  return { insert, search, remove, toArray, size };
}
