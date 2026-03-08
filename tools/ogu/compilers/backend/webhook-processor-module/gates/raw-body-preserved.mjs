import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * WH003 — raw-body-preserved
 * Signature verification requires the raw request body (before JSON parsing).
 * Check that the route uses raw body middleware or reads req.rawBody.
 */

const RAW_BODY_PATTERNS = [
  /req\.rawBody/,
  /express\.raw\s*\(/,
  /bodyParser\.raw\s*\(/,
  /rawBody\s*:/,
  /Buffer\.from\s*\(req\.body/,
  /getRawBody\s*\(/,
  /rawBodySaver|raw-body/,
  /req\.body instanceof Buffer/,
];

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

  for (const pattern of RAW_BODY_PATTERNS) {
    if (pattern.test(allContent)) {
      return { pass: true, code: 'WH003', message: `Raw body preservation found (${files.length} file(s))` };
    }
  }

  return {
    pass: false, code: 'WH003',
    message: 'No raw body preservation found — signature verification will fail with parsed JSON',
    detail: 'Use: express.raw({ type: "application/json" }) or bodyParser.raw() for the webhook route\nOr read req.rawBody if using a rawBodySaver middleware'
  };
}
