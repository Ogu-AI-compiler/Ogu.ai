/**
 * Gate: scenarios-complete (DR003)
 * Validates that every DR scenario declares all required fields and that every
 * step has an action. Incomplete scenarios cannot be executed by on-call
 * engineers under pressure — missing fields make the runbook useless at the
 * exact moment it is needed most.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const REQUIRED_SCENARIO_FIELDS = ['name', 'trigger', 'steps', 'owner'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'dr-runbook-spec.json'), 'utf8'));
  const violations = [];

  for (const scenario of spec.scenarios) {
    const id = scenario.name || '(unnamed)';
    for (const field of REQUIRED_SCENARIO_FIELDS) {
      if (!scenario[field]) {
        violations.push({ scenario: id, field, reason: `Scenario "${id}" is missing required field "${field}"` });
      }
    }
    if (Array.isArray(scenario.steps) && scenario.steps.length === 0) {
      violations.push({ scenario: id, field: 'steps', reason: `Scenario "${id}" has an empty steps array — on-call engineers have nothing to execute` });
    }
    for (const step of (scenario.steps || [])) {
      if (!step.action) {
        violations.push({ scenario: id, field: 'step.action', reason: `A step in scenario "${id}" is missing an action field` });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DR003',
      message: `${violations.length} scenario completeness issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DR003', message: `All ${spec.scenarios.length} scenario(s) complete` };
}
