/**
 * Hilbert Curve — convert between 2D coordinates and Hilbert curve index.
 */
export function xy2d(n, x, y) {
  let rx, ry, s, d = 0;
  let tx = x, ty = y;
  for (s = n / 2; s > 0; s = Math.floor(s / 2)) {
    rx = (tx & s) > 0 ? 1 : 0;
    ry = (ty & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    [tx, ty] = rot(s, tx, ty, rx, ry);
  }
  return d;
}

export function d2xy(n, d) {
  let rx, ry, s, t = d;
  let x = 0, y = 0;
  for (s = 1; s < n; s *= 2) {
    rx = 1 & (Math.floor(t / 2));
    ry = 1 & (t ^ rx);
    [x, y] = rot(s, x, y, rx, ry);
    x += s * rx;
    y += s * ry;
    t = Math.floor(t / 4);
  }
  return [x, y];
}

function rot(n, x, y, rx, ry) {
  if (ry === 0) {
    if (rx === 1) { x = n - 1 - x; y = n - 1 - y; }
    return [y, x];
  }
  return [x, y];
}
