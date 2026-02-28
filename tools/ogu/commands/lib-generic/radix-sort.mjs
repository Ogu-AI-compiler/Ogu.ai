/**
 * Radix Sort — non-comparative integer sorting.
 */
export function radixSort(arr) {
  if (arr.length <= 1) return [...arr];
  const max = Math.max(...arr);
  const result = [...arr];
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    countingSortByDigit(result, exp);
  }
  return result;
}

function countingSortByDigit(arr, exp) {
  const n = arr.length;
  const output = new Array(n);
  const count = new Array(10).fill(0);
  for (let i = 0; i < n; i++) count[Math.floor(arr[i] / exp) % 10]++;
  for (let i = 1; i < 10; i++) count[i] += count[i - 1];
  for (let i = n - 1; i >= 0; i--) {
    const digit = Math.floor(arr[i] / exp) % 10;
    output[count[digit] - 1] = arr[i];
    count[digit]--;
  }
  for (let i = 0; i < n; i++) arr[i] = output[i];
}
