/**
 * Optimizer Adam — Adam optimizer for gradient descent.
 */
export function createAdam({ lr = 0.001, beta1 = 0.9, beta2 = 0.999, epsilon = 1e-8 } = {}) {
  let m = 0, v = 0, t = 0;
  function step(param, gradient) {
    t++;
    m = beta1 * m + (1 - beta1) * gradient;
    v = beta2 * v + (1 - beta2) * gradient * gradient;
    const mHat = m / (1 - Math.pow(beta1, t));
    const vHat = v / (1 - Math.pow(beta2, t));
    return param - lr * mHat / (Math.sqrt(vHat) + epsilon);
  }
  return { step };
}
