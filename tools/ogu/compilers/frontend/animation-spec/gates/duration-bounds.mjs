import { readFileSync } from 'fs';
import { join } from 'path';

const MIN_MS = 50;
const MAX_MS = 2000;

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'animation-spec.json'), 'utf8'));
  const violations = [];

  for (const [name, variant] of Object.entries(spec.variants)) {
    const duration = variant.transition?.duration ?? variant.duration;
    if (duration === undefined) continue;

    // Framer Motion uses seconds; CSS uses ms
    const ms = duration < 10 ? duration * 1000 : duration; // heuristic: <10 = seconds

    if (ms < MIN_MS) {
      violations.push(`Variant '${name}': duration ${duration}s (${ms}ms) is imperceptibly fast — minimum ${MIN_MS}ms`);
    }
    if (ms > MAX_MS) {
      violations.push(`Variant '${name}': duration ${duration}s (${ms}ms) exceeds ${MAX_MS}ms — animations > 2s feel broken to users`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'AN007', message: `Duration out of bounds (${violations.length})`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'AN007', message: `All durations within ${MIN_MS}–${MAX_MS}ms bounds` };
}
