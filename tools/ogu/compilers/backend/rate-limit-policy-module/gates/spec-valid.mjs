import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'rate-limit-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'RL001', message: 'rate-limit-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'RL001', message: `Invalid JSON: ${e.message}` }; }
  const required = ['policyId', 'scope', 'quota', 'windowSeconds', 'strategy'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'RL001', message: `Missing: ${missing.join(', ')}`, detail: 'Required: { policyId, scope: "user"|"ip"|"api-key"|"global", quota: number, windowSeconds: number, strategy: "sliding"|"fixed" }' };
  const validScopes = ['user', 'ip', 'api-key', 'global', 'endpoint'];
  if (!validScopes.includes(spec.scope)) return { pass: false, code: 'RL001', message: `scope must be one of: ${validScopes.join(', ')}` };
  const validStrategies = ['sliding', 'fixed', 'token-bucket', 'leaky-bucket'];
  if (!validStrategies.includes(spec.strategy)) return { pass: false, code: 'RL001', message: `strategy must be one of: ${validStrategies.join(', ')}` };
  if (typeof spec.quota !== 'number' || spec.quota < 1) return { pass: false, code: 'RL001', message: 'quota must be a positive integer' };
  if (typeof spec.windowSeconds !== 'number' || spec.windowSeconds < 1) return { pass: false, code: 'RL001', message: 'windowSeconds must be a positive integer' };
  return { pass: true, code: 'RL001', message: `rate-limit-spec.json valid — ${spec.policyId}: ${spec.quota} req/${spec.windowSeconds}s (${spec.strategy}) by ${spec.scope}` };
}
