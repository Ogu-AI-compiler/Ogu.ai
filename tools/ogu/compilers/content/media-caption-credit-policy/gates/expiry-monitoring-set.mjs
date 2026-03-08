import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** MCP007 — expiry-monitoring-set: time-limited licensed media must have expiryMonitoring declared */
export async function run({ dir }) {
  const specPath = join(dir, 'media-caption-credit-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'MCP007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'MCP007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.mediaTypes) || spec.mediaTypes.length === 0) {
    return { pass: true, code: 'MCP007', message: 'No mediaTypes defined — gate skipped', skipped: true };
  }

  // Only applies to time-limited licensed media
  const timeLimitedTypes = spec.mediaTypes.filter(
    mt => mt.licenseRequired === true && mt.timeLimited === true
  );

  if (timeLimitedTypes.length === 0) {
    return {
      pass: true,
      code: 'MCP007',
      message: 'No time-limited licensed media types — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const mt of timeLimitedTypes) {
    if (!Object.prototype.hasOwnProperty.call(mt, 'expiryMonitoring')) {
      violations.push(
        `Media type "${mt.type}": time-limited licensed media missing expiryMonitoring declaration`
      );
      continue;
    }

    if (typeof mt.expiryMonitoring !== 'boolean') {
      violations.push(
        `Media type "${mt.type}": expiryMonitoring must be boolean, got ${typeof mt.expiryMonitoring}`
      );
    }

    if (mt.expiryMonitoring === false) {
      violations.push(
        `Media type "${mt.type}": time-limited licensed media must have expiryMonitoring:true. ` +
        `Expired licensed content creates immediate copyright liability.`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'MCP007',
      message: `${violations.length} time-limited media type(s) missing expiryMonitoring`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'MCP007',
    message: `All ${timeLimitedTypes.length} time-limited media type(s) have expiryMonitoring:true`,
  };
}
