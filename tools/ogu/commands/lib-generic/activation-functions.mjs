/**
 * Activation Functions — common neural network activations.
 */
export function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
export function relu(x) { return Math.max(0, x); }
export function tanh(x) { return Math.tanh(x); }
export function leakyRelu(x, alpha = 0.01) { return x > 0 ? x : alpha * x; }
export function softplus(x) { return Math.log(1 + Math.exp(x)); }
