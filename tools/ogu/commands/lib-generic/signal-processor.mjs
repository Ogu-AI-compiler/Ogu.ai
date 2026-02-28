/**
 * Signal Processor — basic signal processing operations.
 */
export function createSignalProcessor() {
  function lowpass(signal, alpha) {
    const result = [signal[0]];
    for (let i = 1; i < signal.length; i++) {
      result.push(alpha * signal[i] + (1 - alpha) * result[i-1]);
    }
    return result;
  }
  function amplify(signal, gain) { return signal.map(v => v * gain); }
  function clip(signal, min, max) { return signal.map(v => Math.max(min, Math.min(max, v))); }
  return { lowpass, amplify, clip };
}
