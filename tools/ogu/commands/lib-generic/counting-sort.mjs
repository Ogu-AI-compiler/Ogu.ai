/**
 * Counting Sort — sort non-negative integers in linear time.
 */
export function countingSort(arr) {
  if (arr.length <= 1) return [...arr];
  const max = Math.max(...arr);
  const count = new Array(max + 1).fill(0);
  for (const v of arr) count[v]++;
  const result = [];
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j < count[i]; j++) result.push(i);
  }
  return result;
}
