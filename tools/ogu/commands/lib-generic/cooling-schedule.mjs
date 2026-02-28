/**
 * Cooling Schedule — temperature schedules for simulated annealing.
 */
export function linearCooling(t0, step, totalSteps) {
  return t0 * (1 - step / totalSteps);
}

export function exponentialCooling(t0, step, rate) {
  return t0 * Math.pow(rate, step);
}

export function logarithmicCooling(t0, step) {
  return t0 / Math.log(step + 2);
}
