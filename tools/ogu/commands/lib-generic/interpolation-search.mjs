/**
 * Interpolation Search — search uniformly distributed sorted arrays.
 */
export function interpolationSearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi && target >= arr[lo] && target <= arr[hi]) {
    if (lo === hi) return arr[lo] === target ? lo : -1;
    const pos = lo + Math.floor(((target - arr[lo]) * (hi - lo)) / (arr[hi] - arr[lo]));
    if (arr[pos] === target) return pos;
    if (arr[pos] < target) lo = pos + 1;
    else hi = pos - 1;
  }
  return -1;
}
