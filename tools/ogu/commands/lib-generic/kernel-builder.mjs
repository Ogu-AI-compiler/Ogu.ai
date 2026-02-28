/**
 * Kernel Builder — common convolution kernels.
 */
export function gaussianKernel(size) {
  const kernel = Array.from({ length: size }, () => new Array(size).fill(0));
  const sigma = size / 6;
  const center = Math.floor(size / 2);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      kernel[i][j] = Math.exp(-((i-center)**2 + (j-center)**2) / (2*sigma*sigma));
      sum += kernel[i][j];
    }
  }
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) kernel[i][j] /= sum;
  return kernel;
}

export function sobelX() { return [[-1,0,1],[-2,0,2],[-1,0,1]]; }
export function sobelY() { return [[-1,-2,-1],[0,0,0],[1,2,1]]; }

export function identity(size) {
  const k = Array.from({ length: size }, () => new Array(size).fill(0));
  k[Math.floor(size/2)][Math.floor(size/2)] = 1;
  return k;
}
