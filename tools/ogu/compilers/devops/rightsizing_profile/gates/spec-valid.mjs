/**
 * Gate: spec-valid (RS001)
 * Validates that rightsizing-spec.json exists, is valid JSON, and declares
 * a service name and a non-empty workloads array. Missing fields cause
 * downstream gates (resource requests, node limits, HPA bounds) to fail
 * with misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'rightsizing-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'RS001',
      message: 'rightsizing-spec.json not found',
      detail: { searched: specPath, hint: 'Create rightsizing-spec.json with service and workloads fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'RS001', message: `rightsizing-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = ['service', 'workloads'].filter(f => !spec[f]);
  if (missing.length) {
    return {
      pass: false, code: 'RS001',
      message: `rightsizing-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, hint: 'service identifies the service being profiled; workloads is an array of workload resource profiles' },
    };
  }

  if (!Array.isArray(spec.workloads) || spec.workloads.length === 0) {
    return {
      pass: false, code: 'RS001',
      message: 'workloads must be a non-empty array',
      detail: { hint: 'Add at least one workload with containers, resource requests, and limits' },
    };
  }

  return { pass: true, code: 'RS001', message: `rightsizing-spec.json valid — ${spec.workloads.length} workload(s)` };
}
