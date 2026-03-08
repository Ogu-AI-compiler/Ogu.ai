/**
 * Gate: spec-valid (DNS001)
 * Validates dns-config-spec.json exists, is valid JSON, and every record entry has
 * a hostname, a recognised DNS type, and a target. Invalid or incomplete records
 * produce DNS propagation errors that are extremely difficult to debug in production.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_TYPES = new Set(['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SRV']);

export async function run({ dir }) {
  const specPath = join(dir, 'dns-config-spec.json');
  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'DNS001',
      message: 'dns-config-spec.json not found',
      detail: { hint: 'Create dns-config-spec.json with: { records: [{ hostname, type, target, ttl? }], tls?: [{ hostname, secretName }] }' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false, code: 'DNS001',
      message: `dns-config-spec.json is not valid JSON: ${e.message}`,
      detail: { hint: 'Fix the JSON syntax error before re-running' },
    };
  }

  if (!Array.isArray(spec.records) || spec.records.length === 0) {
    return {
      pass: false, code: 'DNS001',
      message: 'records must be a non-empty array',
      detail: { hint: 'Required: { records: [{ hostname, type: "A"|"CNAME"|..., target }] }' },
    };
  }

  const invalid = spec.records.filter(r => !r.hostname || !r.type || !VALID_TYPES.has(r.type.toUpperCase()) || !r.target);
  if (invalid.length) {
    return {
      pass: false, code: 'DNS001',
      message: `${invalid.length} invalid record entry(ies)`,
      detail: {
        violations: invalid.map(r => ({
          record: r,
          reason: !r.hostname ? 'missing hostname' : !r.type ? 'missing type' : !VALID_TYPES.has(r.type.toUpperCase()) ? `invalid type "${r.type}"` : 'missing target',
        })),
        allowedTypes: [...VALID_TYPES],
        hint: 'Each record needs: { hostname, type (A|AAAA|CNAME|TXT|MX|NS|SRV), target }',
      },
    };
  }

  return {
    pass: true, code: 'DNS001',
    message: `dns-config-spec.json valid — ${spec.records.length} records`,
  };
}
