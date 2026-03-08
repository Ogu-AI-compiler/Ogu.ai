import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * EP002 — envelope-typed
 * Published events must be wrapped in a typed envelope containing:
 * eventType, aggregateId (or id), timestamp, version, payload
 */

const ENVELOPE_FIELDS = ['eventType', 'aggregateId', 'timestamp', 'version', 'payload'];

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(f.name)) walk(join(d, f.name)); }
      else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d, f.name));
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  // Check for envelope type definition
  const ENVELOPE_TYPE = /(?:interface|type)\s+\w*Event(?:Envelope|Message|Record)?\s*(?:=\s*\{|\{)/;
  const hasEnvelopeType = ENVELOPE_TYPE.test(allContent);

  // Check that envelope fields appear together
  const missingFields = ENVELOPE_FIELDS.filter(f => !allContent.includes(f));

  if (missingFields.length > 2) {
    return {
      pass: false, code: 'EP002',
      message: `Envelope fields missing from publisher: ${missingFields.join(', ')}`,
      detail: 'Define a typed envelope: { eventType, aggregateId, timestamp, version, payload }'
    };
  }

  return {
    pass: true, code: 'EP002',
    message: hasEnvelopeType
      ? `Typed event envelope found with required fields`
      : `Envelope fields present: ${ENVELOPE_FIELDS.filter(f => allContent.includes(f)).join(', ')}`
  };
}
