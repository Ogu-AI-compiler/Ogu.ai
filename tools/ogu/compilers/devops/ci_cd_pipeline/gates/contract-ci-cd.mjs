/**
 * Gate: contract-ci-cd (CIP008)
 * Enforces the ci_cd_pipeline runtime contract: deploy jobs must have branch protection
 * (they cannot run on arbitrary branches), long-running jobs must declare a timeout to
 * prevent runaway builds, and the pipeline should define at least one artifact or cache
 * entry for build reproducibility.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const DEPLOY_KEYWORDS = ['deploy', 'release', 'publish'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'ci-cd-spec.json'), 'utf8'));
  const violations = [];

  // Deploy jobs must have branch protection
  const deployJobs = spec.jobs.filter(j =>
    (j.stage && DEPLOY_KEYWORDS.includes(j.stage.toLowerCase())) ||
    DEPLOY_KEYWORDS.some(k => j.name?.toLowerCase().includes(k))
  );
  for (const job of deployJobs) {
    if (!job.branches && !job.only && !job.if && !job.when) {
      violations.push({
        rule:   'deploy-branch-protection',
        job:    job.name,
        reason: `Deploy job "${job.name}" has no branch filter — it can run on any branch including feature branches`,
        hint:   'Add: branches: [main, production], or if: ${{ github.ref == \'refs/heads/main\' }}',
      });
    }
  }

  // Jobs without timeouts (only flag if there are many — a few is acceptable)
  const jobsWithoutTimeout = spec.jobs.filter(j => !j.timeout && !j.timeout_minutes);
  if (jobsWithoutTimeout.length > 3) {
    violations.push({
      rule:    'timeout-required',
      jobs:    jobsWithoutTimeout.map(j => j.name),
      reason:  `${jobsWithoutTimeout.length} jobs have no timeout — runaway builds will block the pipeline indefinitely`,
      hint:    'Add timeout: 30m (or timeout_minutes: 30) to each job',
    });
  }

  // At least one artifact or cache definition for pipelines with multiple jobs
  const hasArtifactOrCache = spec.jobs.some(j => j.artifacts || j.cache || j.outputs);
  if (!hasArtifactOrCache && spec.jobs.length > 2) {
    violations.push({
      rule:   'artifact-or-cache-recommended',
      reason: 'No job defines artifacts or cache — dependency caching can cut build times by 50-80%',
      hint:   'Add cache: { key, paths } to the install/build job',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'CIP008',
      message: `${violations.length} contract violation(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'CIP008',
    message: `CI/CD pipeline contract satisfied — ${spec.jobs.length} jobs on ${spec.platform}`,
  };
}
