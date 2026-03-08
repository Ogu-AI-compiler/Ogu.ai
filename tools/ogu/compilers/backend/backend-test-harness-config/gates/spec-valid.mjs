import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'test-harness-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'TH001', message: 'test-harness-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'TH001', message: `test-harness-spec.json is not valid JSON: ${e.message}` };
  }

  const required = ['runner', 'coverageThresholds', 'environments'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'TH001',
      message: `test-harness-spec.json missing required fields: ${missing.join(', ')}`,
      detail: 'Required shape: { runner: "vitest"|"jest", coverageThresholds: {lines, functions, branches, statements}, environments: [{name, pattern, env}] }'
    };
  }

  const validRunners = ['vitest', 'jest'];
  if (!validRunners.includes(spec.runner)) {
    return { pass: false, code: 'TH001', message: `runner must be "vitest" or "jest", got: "${spec.runner}"` };
  }

  const thresholdKeys = ['lines', 'functions', 'branches', 'statements'];
  const thresholds = spec.coverageThresholds;
  const missingThresholds = thresholdKeys.filter(k => typeof thresholds[k] !== 'number');
  if (missingThresholds.length) {
    return {
      pass: false, code: 'TH001',
      message: `coverageThresholds missing numeric fields: ${missingThresholds.join(', ')}`
    };
  }

  if (!Array.isArray(spec.environments) || spec.environments.length === 0) {
    return { pass: false, code: 'TH001', message: 'environments must be a non-empty array' };
  }

  return {
    pass: true, code: 'TH001',
    message: `test-harness-spec.json valid — runner: ${spec.runner}, ${spec.environments.length} environment(s)`
  };
}
