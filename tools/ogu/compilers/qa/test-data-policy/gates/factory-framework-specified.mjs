import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA085 — factory-framework-specified
 * If the strategy includes "factories", the factory framework must be declared.
 *
 * Different factory frameworks have different capabilities and semantics:
 *   - @faker-js/faker: locale-aware fake data, seeded PRNG
 *   - factory-bot (ruby), factory-boy (python): relationship-aware factories
 *   - fishery: TypeScript-first, stateful sequences
 *   - rosie: lightweight JS factories
 *   - @anatine/zod-mock: generates mocks from Zod schemas (schema-aligned)
 *
 * Without declaring the framework, teams cannot:
 *   - Understand what library to install for new contributors
 *   - Know whether factories support relation chains
 *   - Verify the framework supports seeded PRNG (required by QA084)
 *
 * This gate is skipped if strategy does not include "factories".
 */

const VALID_FRAMEWORKS = new Set([
  'faker', '@faker-js/faker', 'fishery', 'rosie', 'factory-girl',
  '@anatine/zod-mock', 'chance', 'casual', 'generate', 'mock-data',
  'factory-bot', 'factory-boy', 'ffaker', 'generate-js',
]);

// Frameworks known to support seeded PRNG
const SEEDED_PRNG_FRAMEWORKS = new Set([
  'faker', '@faker-js/faker', 'chance', 'fishery', 'generate',
]);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'test-data-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA085', message: 'test-data-policy-spec.json not readable' }; }

  const strategies = Array.isArray(spec.strategy) ? spec.strategy : (spec.strategy ? [spec.strategy] : []);

  if (!strategies.includes('factories')) {
    return { pass: true, code: 'QA085', message: 'Strategy does not include factories — skipped', skipped: true };
  }

  const framework = spec.factoryFramework ?? spec.factory?.framework ?? spec.factories?.framework;

  if (!framework) {
    return {
      pass: false, code: 'QA085',
      message: 'Strategy includes "factories" but spec.factoryFramework not declared',
      detail: `Common frameworks: ${[...VALID_FRAMEWORKS].slice(0, 6).join(', ')}`,
    };
  }

  // Normalize for lookup
  const frameworkNorm = framework.toLowerCase();
  const isKnown = [...VALID_FRAMEWORKS].some(f => f.toLowerCase() === frameworkNorm);

  if (!isKnown) {
    // Unknown frameworks are allowed with a note — don't block on unknown tools
    return {
      pass: true, code: 'QA085',
      message: `factoryFramework: "${framework}" declared (not in known list — verify seeded PRNG support)`,
    };
  }

  const seedSupport = [...SEEDED_PRNG_FRAMEWORKS].some(f => f.toLowerCase() === frameworkNorm);
  const seedNote = seedSupport ? ', supports seeded PRNG' : ' (verify seeded PRNG support for QA084)';

  return {
    pass: true, code: 'QA085',
    message: `factoryFramework: "${framework}"${seedNote}`,
  };
}
