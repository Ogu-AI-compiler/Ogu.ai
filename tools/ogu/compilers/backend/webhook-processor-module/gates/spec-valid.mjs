import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'webhook-processor-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'WH001', message: 'webhook-processor-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'WH001', message: `Invalid JSON: ${e.message}` }; }
  const required = ['provider', 'signatureAlgorithm', 'signatureHeader', 'secretConfigKey'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'WH001', message: `Missing: ${missing.join(', ')}`, detail: 'Required: { provider, signatureAlgorithm: "hmac-sha256"|"hmac-sha1"|"rsa-sha256", signatureHeader, secretConfigKey }' };
  const validAlgos = ['hmac-sha256', 'hmac-sha1', 'rsa-sha256', 'ed25519'];
  if (!validAlgos.includes(spec.signatureAlgorithm)) return { pass: false, code: 'WH001', message: `signatureAlgorithm must be one of: ${validAlgos.join(', ')}` };
  return { pass: true, code: 'WH001', message: `webhook-processor-spec.json valid — provider: ${spec.provider}, algo: ${spec.signatureAlgorithm}` };
}
