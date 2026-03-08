/**
 * Cross Entropy — binary and categorical cross-entropy loss.
 */
export function binaryCrossEntropy(labels, predictions) {
  const n = labels.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const p = Math.max(1e-15, Math.min(1 - 1e-15, predictions[i]));
    sum += labels[i] * Math.log(p) + (1 - labels[i]) * Math.log(1 - p);
  }
  return -sum / n;
}

export function categoricalCrossEntropy(labels, predictions) {
  let sum = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] > 0) sum += labels[i] * Math.log(Math.max(1e-15, predictions[i]));
  }
  return -sum;
}
