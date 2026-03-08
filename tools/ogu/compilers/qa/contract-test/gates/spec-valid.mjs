import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA050 — spec-valid
 * contract-test-spec.json must declare:
 *   - framework: the contract testing framework
 *   - consumer: string (name of the consuming service)
 *   - providers: array of provider objects { name, version? }
 *   - interactions: array of interaction objects { description, request, response }
 *
 * Valid frameworks: pact, pactflow, spring-cloud-contract, dredd, schemathesis
 */

const VALID_FRAMEWORKS = new Set(['pact', 'pactflow', 'spring-cloud-contract', 'dredd', 'schemathesis']);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'contract-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA050', message: 'contract-test-spec.json not found or not valid JSON' }; }

  if (!spec.framework || !VALID_FRAMEWORKS.has(spec.framework)) {
    return {
      pass: false, code: 'QA050',
      message: `spec.framework "${spec.framework ?? 'undefined'}" not valid`,
      detail: `Valid frameworks: ${[...VALID_FRAMEWORKS].join(', ')}`,
    };
  }

  if (!spec.consumer || typeof spec.consumer !== 'string') {
    return { pass: false, code: 'QA050', message: 'spec.consumer is required (name of consuming service)' };
  }

  if (!Array.isArray(spec.providers) || spec.providers.length === 0) {
    return { pass: false, code: 'QA050', message: 'spec.providers must be a non-empty array of provider objects' };
  }

  const providerErrors = [];
  for (const [i, p] of spec.providers.entries()) {
    if (!p.name || typeof p.name !== 'string') {
      providerErrors.push(`providers[${i}]: name is required`);
    }
  }
  if (providerErrors.length) {
    return { pass: false, code: 'QA050', message: 'Provider validation errors', detail: providerErrors.join('\n') };
  }

  if (!Array.isArray(spec.interactions) || spec.interactions.length === 0) {
    return { pass: false, code: 'QA050', message: 'spec.interactions must be a non-empty array' };
  }

  const interactionErrors = [];
  for (const [i, ix] of spec.interactions.entries()) {
    const ref = `interactions[${i}]`;
    if (!ix.description || typeof ix.description !== 'string') interactionErrors.push(`${ref}: description required`);
    if (!ix.request || typeof ix.request !== 'object') interactionErrors.push(`${ref}: request object required`);
    else {
      if (!ix.request.method) interactionErrors.push(`${ref}.request: method required`);
      if (!ix.request.path) interactionErrors.push(`${ref}.request: path required`);
    }
    if (!ix.response || typeof ix.response !== 'object') interactionErrors.push(`${ref}: response object required`);
    else if (typeof ix.response.status !== 'number') interactionErrors.push(`${ref}.response: status (number) required`);
  }

  if (interactionErrors.length) {
    return {
      pass: false, code: 'QA050',
      message: `${interactionErrors.length} interaction error(s)`,
      detail: interactionErrors.join('\n'),
    };
  }

  return {
    pass: true, code: 'QA050',
    message: `Spec valid — ${spec.framework}, consumer: ${spec.consumer}, ${spec.providers.length} provider(s), ${spec.interactions.length} interaction(s)`,
  };
}
