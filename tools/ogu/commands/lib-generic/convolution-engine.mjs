/**
 * Convolution Engine — 1D and 2D convolution.
 */
export function convolve1d(signal, kernel) {
  const result = [];
  const kLen = kernel.length, half = Math.floor(kLen / 2);
  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    for (let k = 0; k < kLen; k++) {
      const idx = i + k - half;
      if (idx >= 0 && idx < signal.length) sum += signal[idx] * kernel[k];
    }
    result.push(sum);
  }
  return result;
}

export function convolve2d(image, kernel) {
  const rows = image.length, cols = image[0].length;
  const kRows = kernel.length, kCols = kernel[0].length;
  const hR = Math.floor(kRows / 2), hC = Math.floor(kCols / 2);
  const result = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let ki = 0; ki < kRows; ki++) {
        for (let kj = 0; kj < kCols; kj++) {
          const ri = i + ki - hR, rj = j + kj - hC;
          if (ri >= 0 && ri < rows && rj >= 0 && rj < cols) sum += image[ri][rj] * kernel[ki][kj];
        }
      }
      result[i][j] = sum;
    }
  }
  return result;
}
