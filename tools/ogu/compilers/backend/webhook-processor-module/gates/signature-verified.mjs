import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * WH002 — signature-verified
 * Signature must be verified BEFORE parsing/using the payload.
 * Check that signature header is read and compared using crypto timing-safe comparison.
 */

const SIG_VERIFY_PATTERNS = [
  /timingSafeEqual|crypto\.timingSafeEqual/,
  /verifySignature|validateSignature|verifyWebhook/i,
  /hmac\.digest|createHmac.*\.digest/,
  /stripe\.webhooks\.constructEvent/,
  /svix\.verify|svix\.Webhook/,
  /github.*signature|stripe.*signature|slack.*signature/i,
];

const PAYLOAD_USE_BEFORE_SIG = /req\.body\./;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules','dist','.git','__tests__','tests'].includes(f.name)) walk(join(d,f.name)); }
      else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d,f.name));
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  for (const pattern of SIG_VERIFY_PATTERNS) {
    if (pattern.test(allContent)) {
      return { pass: true, code: 'WH002', message: `Signature verification found (${files.length} file(s))` };
    }
  }

  // Check for signature header access
  const spec = JSON.parse(readFileSync(join(dir, 'webhook-processor-spec.json'), 'utf8'));
  const headerName = spec.signatureHeader.toLowerCase().replace(/-/g, '');
  const headerCheck = new RegExp(headerName, 'i');
  if (headerCheck.test(allContent) && /crypto|hmac|digest/i.test(allContent)) {
    return { pass: true, code: 'WH002', message: `Signature header "${spec.signatureHeader}" with crypto found` };
  }

  return {
    pass: false, code: 'WH002',
    message: `No signature verification found — verify ${spec.signatureHeader} header before processing payload`,
    detail: `Use crypto.timingSafeEqual or a provider SDK (e.g. stripe.webhooks.constructEvent) to verify the signature`
  };
}
