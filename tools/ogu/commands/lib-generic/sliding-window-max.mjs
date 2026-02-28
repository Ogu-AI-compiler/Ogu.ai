/**
 * Sliding Window Max — find maximum in each sliding window.
 */
export function slidingWindowMax(arr, k) {
  const result = [];
  const deque = []; // indices
  for (let i = 0; i < arr.length; i++) {
    while (deque.length > 0 && deque[0] < i - k + 1) deque.shift();
    while (deque.length > 0 && arr[deque[deque.length - 1]] <= arr[i]) deque.pop();
    deque.push(i);
    if (i >= k - 1) result.push(arr[deque[0]]);
  }
  return result;
}
