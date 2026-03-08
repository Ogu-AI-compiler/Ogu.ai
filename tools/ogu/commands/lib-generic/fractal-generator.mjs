/**
 * Fractal Generator — generate fractal point sets.
 */
export function sierpinski(depth) {
  const points = [];
  const corners = [[0, 0], [1, 0], [0.5, Math.sqrt(3) / 2]];

  function generate(ax, ay, bx, by, cx, cy, d) {
    if (d === 0) { points.push([(ax + bx + cx) / 3, (ay + by + cy) / 3]); return; }
    const abx = (ax + bx) / 2, aby = (ay + by) / 2;
    const bcx = (bx + cx) / 2, bcy = (by + cy) / 2;
    const acx = (ax + cx) / 2, acy = (ay + cy) / 2;
    generate(ax, ay, abx, aby, acx, acy, d - 1);
    generate(abx, aby, bx, by, bcx, bcy, d - 1);
    generate(acx, acy, bcx, bcy, cx, cy, d - 1);
  }

  generate(corners[0][0], corners[0][1], corners[1][0], corners[1][1], corners[2][0], corners[2][1], depth);
  return points;
}

export function mandelbrot(cr, ci, maxIter) {
  let zr = 0, zi = 0;
  for (let i = 0; i < maxIter; i++) {
    const zr2 = zr * zr, zi2 = zi * zi;
    if (zr2 + zi2 > 4) return i;
    zi = 2 * zr * zi + ci;
    zr = zr2 - zi2 + cr;
  }
  return maxIter;
}
