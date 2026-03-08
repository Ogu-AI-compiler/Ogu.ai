/**
 * Dense Vector — fixed-length numeric vector with operations.
 */
export function createDenseVector(values) {
  const data = [...values];

  function get(i) { return data[i]; }
  function size() { return data.length; }

  function dot(other) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * other.get(i);
    return sum;
  }

  function scale(s) {
    return createDenseVector(data.map(v => v * s));
  }

  function add(other) {
    return createDenseVector(data.map((v, i) => v + other.get(i)));
  }

  function toArray() { return [...data]; }

  return { get, size, dot, scale, add, toArray };
}
