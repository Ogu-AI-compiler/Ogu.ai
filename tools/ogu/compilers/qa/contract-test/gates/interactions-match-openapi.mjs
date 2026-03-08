import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * QA053 — interactions-match-openapi
 * If an OpenAPI spec is referenced, every interaction path must exist in it.
 *
 * Contract tests that reference non-existent API paths are either:
 *   - Testing a removed/renamed endpoint (stale contract)
 *   - Testing a path that was never in the spec (invalid contract)
 *
 * This gate is skipped if spec.openApiSpec is not declared.
 *
 * Checks:
 *   1. OpenAPI file exists and is parseable
 *   2. Every interaction.request.path exists in paths (with param substitution)
 *   3. Every interaction.request.method is valid for that path
 */

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

/** Convert OpenAPI path template to regex: /users/{id} → /users/[^/]+ */
function openApiPathToRegex(p) {
  return new RegExp('^' + p.replace(/\{[^}]+\}/g, '[^/]+') + '$');
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'contract-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA053', message: 'contract-test-spec.json not readable' }; }

  if (!spec.openApiSpec) {
    return { pass: true, code: 'QA053', message: 'openApiSpec not declared — skipped', skipped: true };
  }

  const openApiPath = join(dir, spec.openApiSpec);
  if (!existsSync(openApiPath)) {
    return {
      pass: false, code: 'QA053',
      message: `openApiSpec file not found: ${spec.openApiSpec}`,
    };
  }

  let openApi;
  try {
    const raw = readFileSync(openApiPath, 'utf8');
    openApi = JSON.parse(raw);
  } catch {
    return { pass: false, code: 'QA053', message: `openApiSpec not valid JSON: ${spec.openApiSpec}` };
  }

  const oasPaths = Object.keys(openApi.paths ?? {});
  if (oasPaths.length === 0) {
    return { pass: false, code: 'QA053', message: 'OpenAPI spec has no paths defined' };
  }

  const pathRegexes = oasPaths.map(p => ({ template: p, regex: openApiPathToRegex(p), methods: openApi.paths[p] }));

  const violations = [];
  for (const [i, ix] of (spec.interactions ?? []).entries()) {
    const req = ix.request ?? {};
    const path = req.path;
    const method = (req.method ?? '').toLowerCase();

    if (!path) { violations.push(`interactions[${i}] "${ix.description}": request.path missing`); continue; }

    const matched = pathRegexes.find(pr => pr.regex.test(path));
    if (!matched) {
      violations.push(`interactions[${i}] "${ix.description}": path "${path}" not found in OpenAPI spec`);
      continue;
    }

    if (method && HTTP_METHODS.has(method) && !matched.methods[method]) {
      violations.push(`interactions[${i}] "${ix.description}": method "${req.method}" not defined for path "${matched.template}"`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA053',
      message: `${violations.length} interaction(s) don't match OpenAPI spec`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true, code: 'QA053',
    message: `All ${spec.interactions.length} interactions matched against ${oasPaths.length} OpenAPI paths`,
  };
}
