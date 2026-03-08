/**
 * Gate UEV005 — analytics-parity
 * If spec has analyticsEvents array, every event name declared must be
 * identical across all variants (same event name, possibly different properties).
 * Per-variant evaluation: compare each variant's events against the control's events.
 * Missing events in any variant are violations.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'experiment-variant-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UEV005',
      message: 'experiment-variant-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UEV005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.analyticsEvents) || spec.analyticsEvents.length === 0) {
    return {
      pass: true,
      code: 'UEV005',
      message: 'analytics-parity: no analyticsEvents declared — gate not applicable',
    };
  }

  if (!Array.isArray(spec.variants)) {
    return {
      pass: true,
      code: 'UEV005',
      message: 'No variants array — skipped',
      skipped: true,
    };
  }

  // Collect all canonical event names from top-level analyticsEvents
  const canonicalEventNames = new Set(
    spec.analyticsEvents.map(e => (typeof e === 'string' ? e : e.name)).filter(Boolean)
  );

  if (canonicalEventNames.size === 0) {
    return {
      pass: true,
      code: 'UEV005',
      message: 'analytics-parity: analyticsEvents has no named events — gate not applicable',
    };
  }

  const violations = [];

  spec.variants.forEach((v, i) => {
    const id = v.id || `variants[${i}]`;
    const variantEvents = Array.isArray(v.analyticsEvents) ? v.analyticsEvents : [];
    const variantEventNames = new Set(
      variantEvents.map(e => (typeof e === 'string' ? e : e.name)).filter(Boolean)
    );

    canonicalEventNames.forEach(eventName => {
      if (!variantEventNames.has(eventName)) {
        violations.push(`Variant "${id}" missing analytics event "${eventName}"`);
      }
    });
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UEV005',
      message: `${violations.length} analytics event parity violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UEV005',
    message: `analytics-parity: all ${spec.variants.length} variant(s) track the same ${canonicalEventNames.size} analytics event(s)`,
  };
}
