import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'event-publisher-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'EP001', message: 'event-publisher-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'EP001', message: `Invalid JSON: ${e.message}` }; }

  const required = ['eventType', 'aggregateType', 'channel', 'payloadType'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'EP001', message: `Missing: ${missing.join(', ')}`, detail: 'Required: { eventType: string, aggregateType: string, channel: string, payloadType: string, version?: number }' };

  return { pass: true, code: 'EP001', message: `event-publisher-spec.json valid — event: ${spec.eventType}, channel: ${spec.channel}` };
}
