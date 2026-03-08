/**
 * Gate: contract-dr-runbook (DR008)
 * Validates that the DR runbook satisfies the contract: scenario names must
 * be unique, at least one data loss/restore scenario must be covered, every
 * scenario must have an owner, and the service name must match the compiled
 * Kubernetes workload when a workload artifact is available.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'dr-runbook-spec.json'), 'utf8'));
  const violations = [];

  // Scenario names must be unique
  const names = spec.scenarios.map(s => s.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) {
    violations.push({
      rule:   'unique-scenario-names',
      dupes:  [...new Set(dupes)],
      reason: `Duplicate scenario names: ${[...new Set(dupes)].join(', ')} — on-call engineers cannot distinguish which scenario to execute`,
    });
  }

  // At least one scenario must explicitly cover data loss or backup restoration
  const hasDataLossScenario = spec.scenarios.some(s =>
    /data.?loss|corrupt|backup|restore|recover/i.test(`${s.name} ${s.trigger || ''}`)
  );
  if (!hasDataLossScenario && !spec.skipDataLossScenario) {
    violations.push({
      rule:   'data-loss-scenario-required',
      reason: 'No data loss/corruption/restore scenario defined — DR runbooks must cover data loss scenarios',
      hint:   'Add a scenario covering data loss, corruption, or backup restoration. Set skipDataLossScenario: true with justification for exemption.',
    });
  }

  // Every scenario must have an owner
  const noOwner = spec.scenarios.filter(s => !s.owner);
  if (noOwner.length) {
    violations.push({
      rule:      'scenario-owner-required',
      scenarios: noOwner.map(s => s.name || '(unnamed)'),
      reason:    `${noOwner.length} scenario(s) are missing an owner — without an owner, no one is accountable for executing the scenario`,
    });
  }

  // Cross-artifact: if a k8s-workload-artifact lives next to this directory, service must match
  const candidates = [
    join(dir, '..', 'kubernetes_workload', 'k8s-workload-artifact.json'),
    join(dir, 'k8s-workload-artifact.json'),
  ];
  const workloadArtifactPath = candidates.find(p => existsSync(p));

  if (workloadArtifactPath) {
    const wa = JSON.parse(readFileSync(workloadArtifactPath, 'utf8'));
    if (wa.workload_name && spec.service !== wa.workload_name && !spec.skipWorkloadMatch) {
      violations.push({
        rule:          'service-workload-match',
        specService:   spec.service,
        workloadName:  wa.workload_name,
        reason:        `spec.service "${spec.service}" does not match compiled workload "${wa.workload_name}"`,
        hint:          'Update spec.service to match the workload name, or set skipWorkloadMatch: true if this runbook covers multiple workloads',
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DR008',
      message: `${violations.length} contract violation(s) in dr-runbook-spec.json`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'DR008',
    message: `DR runbook contract satisfied — ${spec.scenarios.length} scenario(s), service: ${spec.service}`,
  };
}
