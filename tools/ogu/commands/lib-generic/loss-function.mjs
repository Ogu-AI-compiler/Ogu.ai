/**
 * Loss Function — MSE, MAE loss functions.
 */
export function mse(predicted, actual) {
  const n = predicted.length;
  return predicted.reduce((s, p, i) => s + (p - actual[i]) ** 2, 0) / n;
}

export function mae(predicted, actual) {
  const n = predicted.length;
  return predicted.reduce((s, p, i) => s + Math.abs(p - actual[i]), 0) / n;
}
