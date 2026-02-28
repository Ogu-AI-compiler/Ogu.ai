/**
 * FFT Calculator — Cooley-Tukey radix-2 FFT.
 */
export function fft(input) {
  const n = input.length;
  if (n <= 1) return input.map(v => ({ re: v, im: 0 }));
  const even = fft(input.filter((_, i) => i % 2 === 0).map(v => typeof v === 'number' ? v : v.re));
  const odd = fft(input.filter((_, i) => i % 2 === 1).map(v => typeof v === 'number' ? v : v.re));
  const result = new Array(n);
  for (let k = 0; k < n / 2; k++) {
    const angle = -2 * Math.PI * k / n;
    const tRe = Math.cos(angle) * (odd[k]?.re || 0) - Math.sin(angle) * (odd[k]?.im || 0);
    const tIm = Math.sin(angle) * (odd[k]?.re || 0) + Math.cos(angle) * (odd[k]?.im || 0);
    result[k] = { re: (even[k]?.re || 0) + tRe, im: (even[k]?.im || 0) + tIm };
    result[k + n/2] = { re: (even[k]?.re || 0) - tRe, im: (even[k]?.im || 0) - tIm };
  }
  return result;
}
