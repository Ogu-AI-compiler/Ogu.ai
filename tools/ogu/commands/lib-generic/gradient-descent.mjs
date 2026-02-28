/**
 * Gradient Descent — iterative optimization.
 */
export function gradientDescent(gradient, initial, learningRate, iterations) {
  let x = initial;
  for (let i = 0; i < iterations; i++) {
    x = x - learningRate * gradient(x);
  }
  return x;
}
