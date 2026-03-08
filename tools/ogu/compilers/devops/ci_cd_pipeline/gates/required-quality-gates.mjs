/**
 * Gate: required-quality-gates (CIP006)
 * Verifies that the pipeline includes both a build stage and a test/lint stage.
 * A pipeline that only deploys without building or testing provides no quality
 * assurance — it is a deployment script, not a CI/CD pipeline.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const REQUIRED = [
  { name: 'build', patterns: ['build', 'compile', 'package', 'bundle'] },
  { name: 'test',  patterns: ['test', 'spec', 'lint', 'check', 'validate', 'quality'] },
];

function stagesOrJobsContain(spec, patterns) {
  const allNames = [
    ...spec.stages,
    ...spec.jobs.map(j => j.name),
    ...spec.jobs.map(j => j.stage).filter(Boolean),
  ].map(n => n.toLowerCase());
  return patterns.some(p => allNames.some(n => n.includes(p)));
}

export async function run({ dir }) {
  const spec    = JSON.parse(readFileSync(join(dir, 'ci-cd-spec.json'), 'utf8'));
  const missing = REQUIRED.filter(r => !stagesOrJobsContain(spec, r.patterns));

  if (missing.length) {
    return {
      pass: false, code: 'CIP006',
      message: `Required stage(s) missing: ${missing.map(m => m.name).join(', ')}`,
      detail: {
        missing: missing.map(m => ({ stage: m.name, acceptedNames: m.patterns })),
        currentStages: spec.stages,
        hint: 'A CI/CD pipeline must include at minimum a build stage and a test/lint stage before deployment',
      },
    };
  }

  return {
    pass: true, code: 'CIP006',
    message: `Required quality stages present: ${spec.stages.join(', ')}`,
  };
}
