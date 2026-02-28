/**
 * Monotonic Stack — find next greater/smaller elements.
 */
export function nextGreaterElement(arr) {
  const result = new Array(arr.length).fill(-1);
  const stack = [];
  for (let i = 0; i < arr.length; i++) {
    while (stack.length > 0 && arr[stack[stack.length - 1]] < arr[i]) {
      result[stack.pop()] = arr[i];
    }
    stack.push(i);
  }
  return result;
}

export function nextSmallerElement(arr) {
  const result = new Array(arr.length).fill(-1);
  const stack = [];
  for (let i = 0; i < arr.length; i++) {
    while (stack.length > 0 && arr[stack[stack.length - 1]] > arr[i]) {
      result[stack.pop()] = arr[i];
    }
    stack.push(i);
  }
  return result;
}
