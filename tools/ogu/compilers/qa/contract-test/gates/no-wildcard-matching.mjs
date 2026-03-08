import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA054 — no-wildcard-matching
 * Interactions must not use wildcard matchers for critical response fields.
 *
 * Wildcard/any-value matchers in consumer contracts allow providers to return
 * anything and still "pass" — defeating the purpose of contract testing.
 *
 * Specifically flagged patterns in response bodies:
 *   - Pact v2: { "json_class": "Pact::SomethingLike" } anywhere in response
 *   - Pact v2: { "json_class": "Pact::ArrayLike" } with no type constraints
 *   - Pact v3: matchingRules with type "type" (not "regex" or "integer" etc.)
 *     on fields that look like IDs, status codes, or required string fields
 *   - Response bodies that are just `{}` (empty — no assertions)
 *   - interactions[i].response.body: null with no matching rules
 *
 * This gate checks for the most common misuse patterns. It cannot perform
 * full Pact AST analysis — it operates on the spec shape only.
 *
 * Escape hatch: add `"wildcardOk": true` to an interaction to suppress this gate for it.
 */

function hasWildcardMatcher(obj, depth = 0) {
  if (depth > 10 || obj === null || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(v => hasWildcardMatcher(v, depth + 1));
  // Pact v2 SomethingLike
  if (obj.json_class === 'Pact::SomethingLike') return true;
  // matchingRules with type:type (matches anything of that primitive type)
  if (obj.matchers && Array.isArray(obj.matchers)) {
    if (obj.matchers.some(m => m.match === 'type')) return true;
  }
  return Object.values(obj).some(v => hasWildcardMatcher(v, depth + 1));
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'contract-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA054', message: 'contract-test-spec.json not readable' }; }

  const violations = [];

  for (const [i, ix] of (spec.interactions ?? []).entries()) {
    if (ix.wildcardOk === true) continue; // explicit escape hatch

    const ref = `interactions[${i}] "${ix.description ?? 'unnamed'}"`;
    const body = ix.response?.body;

    // Empty body with no matching rules
    if (body !== undefined && body !== null) {
      if (typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0) {
        violations.push(`${ref}: response.body is {} — no assertions on response structure`);
        continue;
      }
      if (hasWildcardMatcher(body)) {
        violations.push(`${ref}: response.body contains wildcard/SomethingLike matcher — contracts must assert specific types or values`);
      }
    } else if (body === null) {
      // null body — only ok if response is explicitly 204 No Content or similar
      const status = ix.response?.status;
      if (status !== 204 && status !== 304) {
        violations.push(`${ref}: response.body is null for status ${status} — add assertions or set status: 204`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA054',
      message: `${violations.length} interaction(s) use wildcard or empty matching`,
      detail: violations.join('\n') + '\n\nAdd "wildcardOk": true to an interaction to explicitly accept wildcard matching for it.',
    };
  }

  return { pass: true, code: 'QA054', message: `No wildcard matchers — ${spec.interactions?.length ?? 0} interaction(s) checked` };
}
