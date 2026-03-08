/**
 * Perceptron — single-layer binary classifier.
 */
export function createPerceptron(inputSize, learningRate = 0.1) {
  const weights = new Array(inputSize).fill(0).map(() => Math.random() * 2 - 1);
  let bias = 0;
  function predict(input) {
    let sum = bias;
    for (let i = 0; i < inputSize; i++) sum += weights[i] * input[i];
    return sum >= 0 ? 1 : 0;
  }
  function train(input, target) {
    const output = predict(input);
    const error = target - output;
    for (let i = 0; i < inputSize; i++) weights[i] += learningRate * error * input[i];
    bias += learningRate * error;
  }
  function getWeights() { return [...weights]; }
  return { predict, train, getWeights };
}
