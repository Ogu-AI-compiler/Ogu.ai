/**
 * Gate: contract-iac (IAC008)
 * Enforces the iac_stack_definition runtime contract: remote state must be configured
 * for multi-person teams, the environment matrix must include both a pre-production
 * and a production environment, and every typed input must have a description so
 * operators understand what value is expected without reading Terraform source.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'iac-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.stateBackend || spec.stateBackend.trim() === '') {
    violations.push({
      rule:   'state-backend-required',
      reason: 'State backend not configured — remote state is required for team environments',
      hint:   'Set stateBackend to: "s3://my-bucket/state", "gcs://my-bucket/state", or "azurerm"',
    });
  }

  const envs = (spec.environments || []).map(e => e.toLowerCase());
  if (!envs.includes('production') && !envs.includes('prod')) {
    violations.push({
      rule:   'production-env-required',
      reason: 'No production environment in the environments matrix',
      hint:   'Add "production" (or "prod") to the environments array',
    });
  }
  if (!envs.some(e => e.includes('staging') || e.includes('stage') || e.includes('dev') || e.includes('test'))) {
    violations.push({
      rule:   'non-prod-env-required',
      reason: 'No pre-production environment defined — add staging or dev to validate changes before production',
      hint:   'Add "staging" or "dev" to the environments array',
    });
  }

  const inputsWithoutDesc = (spec.inputs || []).filter(i => typeof i === 'object' && !i.description);
  if (inputsWithoutDesc.length > 0) {
    violations.push({
      rule:   'inputs-need-descriptions',
      inputs: inputsWithoutDesc.map(i => i.name),
      reason: 'All typed inputs must have a description — operators need to understand what value is expected',
      hint:   'Add a description field to each input entry in iac-spec.json',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'IAC008',
      message: `${violations.length} contract violation(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'IAC008',
    message: `IaC stack contract satisfied — ${spec.platform} on ${spec.cloud} (${spec.environments.join(', ')})`,
  };
}
