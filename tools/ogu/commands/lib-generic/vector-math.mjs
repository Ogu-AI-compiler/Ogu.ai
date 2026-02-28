/**
 * Vector Math — basic vector operations.
 */
export function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function add(a, b) {
  return a.map((v, i) => v + b[i]);
}

export function subtract(a, b) {
  return a.map((v, i) => v - b[i]);
}

export function scale(v, s) {
  return v.map(x => x * s);
}

export function magnitude(v) {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

export function normalize(v) {
  const mag = magnitude(v);
  if (mag === 0) return v.map(() => 0);
  return v.map(x => x / mag);
}

export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
