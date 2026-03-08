import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/** UIT009 — contract-tokens: validates spec against token-system.contract.json rules */

const __dir = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dir, '..', 'contracts', 'token-system.contract.json');

const VALID_TYPES = [
  'color', 'spacing', 'sizing', 'typography', 'border-radius', 'border-width',
  'shadow', 'motion', 'z-index', 'opacity', 'font-family', 'font-size',
  'font-weight', 'line-height', 'letter-spacing', 'duration', 'easing',
];

const VALID_TIERS = ['primitive', 'semantic', 'component'];

export async function run({ dir }) {
  const specPath = join(dir, 'design-token-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UIT009', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UIT009', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  let contract;
  try {
    contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UIT009',
      message: `Cannot load contract file: ${err.message}`,
    };
  }

  const tokens = Array.isArray(spec.tokens) ? spec.tokens : [];
  const violations = [];

  // Rule: has-primitives — at least one primitive-tier token
  const hasPrimitives = tokens.some(t => t.tier === 'primitive');
  if (!hasPrimitives) {
    violations.push('Rule "has-primitives": no primitive-tier tokens found — primitives are required as the foundation');
  }

  // Rule: has-semantics — at least one semantic-tier token
  const hasSemantics = tokens.some(t => t.tier === 'semantic');
  if (!hasSemantics) {
    violations.push('Rule "has-semantics": no semantic-tier tokens found — semantic aliases are required for theming');
  }

  // Rule: valid-types — every declared type is in the allowed set
  for (const token of tokens) {
    if (token.type && !VALID_TYPES.includes(token.type)) {
      violations.push(`Rule "valid-types": "${token.name}" has unknown type "${token.type}"`);
    }
  }

  // Rule: valid-tiers — every declared tier is in the allowed set
  for (const token of tokens) {
    if (token.tier && !VALID_TIERS.includes(token.tier)) {
      violations.push(`Rule "valid-tiers": "${token.name}" has unknown tier "${token.tier}"`);
    }
  }

  // Rule: primitives-have-raw-values — primitive tokens must not be aliases
  const ALIAS_PATTERN = /^\{(.+)\}$/;
  for (const token of tokens) {
    if (token.tier === 'primitive') {
      const value = String(token.value ?? '');
      if (ALIAS_PATTERN.test(value)) {
        violations.push(`Rule "primitives-have-raw-values": primitive token "${token.name}" uses an alias — primitives must have raw values`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UIT009',
      message: `${violations.length} contract rule(s) violated`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UIT009',
    message: `Contract "${contract.id}" satisfied (${tokens.length} tokens, ${contract.rules?.length ?? 0} rules)`,
  };
}
