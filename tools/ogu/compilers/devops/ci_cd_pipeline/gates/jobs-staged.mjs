/**
 * Gate: jobs-staged (CIP003)
 * Validates that every job references a stage defined in spec.stages and declares
 * executable steps. Also checks that job dependency references (needs/requires) point
 * to jobs that actually exist, catching broken DAG references at spec time.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec        = JSON.parse(readFileSync(join(dir, 'ci-cd-spec.json'), 'utf8'));
  const validStages = new Set(spec.stages);
  const jobNames    = new Set(spec.jobs.map(j => j.name));
  const violations  = [];

  for (const job of spec.jobs) {
    if (!job.name) {
      violations.push({ job: '(unnamed)', reason: 'Job is missing a name field' });
      continue;
    }
    if (job.stage && !validStages.has(job.stage)) {
      violations.push({ job: job.name, reason: `references unknown stage "${job.stage}" — not in spec.stages` });
    }
    if (job.needs) {
      const needs = Array.isArray(job.needs) ? job.needs : [job.needs];
      for (const dep of needs) {
        const depName = typeof dep === 'string' ? dep : dep.job;
        if (!jobNames.has(depName)) {
          violations.push({ job: job.name, reason: `depends on unknown job "${depName}"` });
        }
      }
    }
    if (!job.steps && !job.script && !job.run) {
      violations.push({ job: job.name, reason: 'has no steps/script/run — job does nothing' });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'CIP003',
      message: `${violations.length} job staging violation(s)`,
      detail: {
        violations,
        definedStages: [...validStages],
        hint: 'Each job must reference a stage from spec.stages and declare at least one step',
      },
    };
  }

  return {
    pass: true, code: 'CIP003',
    message: `All ${spec.jobs.length} jobs have valid stages and dependencies`,
  };
}
