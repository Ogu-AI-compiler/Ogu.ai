/**
 * Neural Network Layer — dense layer with forward pass.
 */
export function createLayer(inputSize, outputSize, initializer) {
  const { weights, biases } = initializer ? initializer() : (() => {
    const w = Array.from({ length: outputSize }, () =>
      Array.from({ length: inputSize }, () => Math.random() * 2 - 1)
    );
    const b = new Array(outputSize).fill(0);
    return { weights: w, biases: b };
  })();

  function forward(input) {
    const output = new Array(outputSize);
    for (let i = 0; i < outputSize; i++) {
      let sum = biases[i];
      for (let j = 0; j < inputSize; j++) sum += weights[i][j] * input[j];
      output[i] = sum;
    }
    return output;
  }
  function getWeights() { return { weights: weights.map(r => [...r]), biases: [...biases] }; }
  return { forward, getWeights };
}
