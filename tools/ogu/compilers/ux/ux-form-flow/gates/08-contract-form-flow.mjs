/**
 * Gate UFF008 — contract-form-flow
 * Final contract check:
 * - version declared
 * - unique field ids
 * - each field has id + type
 * - submission.method declared (POST / PUT / PATCH)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_METHODS = new Set(['POST', 'PUT', 'PATCH']);

export async function run({ dir }) {
  const specPath = join(dir, 'form-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UFF008',
      message: 'form-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UFF008',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.fields)) {
    return {
      pass: true,
      code: 'UFF008',
      message: 'No fields array — skipped',
      skipped: true,
    };
  }

  const violations = [];

  // Rule: version declared
  if (!spec.version) {
    violations.push('Contract: form-flow-spec.json missing field "version"');
  }

  // Rule: each field has id and type
  spec.fields.forEach((field, i) => {
    if (typeof field.id !== 'string' || field.id.trim() === '') {
      violations.push(`Contract: fields[${i}] missing field "id" (string)`);
    }
    if (typeof field.type !== 'string' || field.type.trim() === '') {
      violations.push(`Contract: fields[${i}](id="${field.id ?? 'unknown'}") missing field "type"`);
    }
  });

  // Rule: unique field ids
  const seenIds = new Map();
  for (const field of spec.fields) {
    if (typeof field.id !== 'string') continue;
    if (seenIds.has(field.id)) {
      violations.push(`Contract: Duplicate field id "${field.id}"`);
    } else {
      seenIds.set(field.id, true);
    }
  }

  // Rule: submission.method declared
  if (typeof spec.submission === 'object' && spec.submission !== null) {
    const method = spec.submission.method;
    if (typeof method !== 'string') {
      violations.push('Contract: submission.method is missing — must be POST, PUT, or PATCH');
    } else if (!VALID_METHODS.has(method.toUpperCase())) {
      violations.push(
        `Contract: submission.method="${method}" is invalid — must be POST, PUT, or PATCH`
      );
    }
  } else {
    violations.push('Contract: submission object missing — cannot check method');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UFF008',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UFF008',
    message: 'contract-form-flow: all contract rules satisfied',
  };
}
