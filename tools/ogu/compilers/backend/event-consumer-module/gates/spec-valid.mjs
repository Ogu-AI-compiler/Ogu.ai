import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'event-consumer-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'EC001', message: 'event-consumer-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'EC001', message: `Invalid JSON: ${e.message}` }; }
  const required = ['eventType', 'channels', 'handlerName', 'idempotencyKey'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'EC001', message: `Missing: ${missing.join(', ')}`, detail: 'Required: { eventType, channels: string[], handlerName, idempotencyKey: "eventId"|"messageId"|custom }' };
  if (!Array.isArray(spec.channels) || spec.channels.length === 0) return { pass: false, code: 'EC001', message: 'channels must be a non-empty array' };
  return { pass: true, code: 'EC001', message: `event-consumer-spec.json valid — handler: ${spec.handlerName}, channels: [${spec.channels.join(', ')}]` };
}
