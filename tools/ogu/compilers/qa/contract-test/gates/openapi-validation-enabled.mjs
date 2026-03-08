import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA055 — openapi-validation-enabled
 * If an OpenAPI spec is available, request/response validation should be enabled.
 *
 * Tools like Dredd, Schemathesis, and Pact-OpenAPI can validate that:
 *   - Request bodies match the schema defined in OpenAPI
 *   - Response bodies match what the spec promises
 *   - Required fields are present, types are correct, enums are respected
 *
 * Without this, contract tests can pass while violating the API contract
 * defined in the OpenAPI spec — the two sources of truth drift apart.
 *
 * If spec.openApiSpec is not declared, this gate is skipped.
 *
 * Checks:
 *   spec.validateAgainstOpenApi: true
 *   OR spec.validation.enabled: true
 *   OR spec.framework === "schemathesis" or "dredd" (inherently OpenAPI-based)
 */

const OPENAPI_NATIVE_FRAMEWORKS = new Set(['schemathesis', 'dredd']);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'contract-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA055', message: 'contract-test-spec.json not readable' }; }

  if (!spec.openApiSpec) {
    return { pass: true, code: 'QA055', message: 'openApiSpec not declared — skipped', skipped: true };
  }

  // Frameworks that are inherently OpenAPI-driven
  if (OPENAPI_NATIVE_FRAMEWORKS.has(spec.framework)) {
    return {
      pass: true, code: 'QA055',
      message: `Framework "${spec.framework}" validates against OpenAPI by design`,
    };
  }

  const enabled = spec.validateAgainstOpenApi
    ?? spec.validation?.enabled
    ?? spec.validation?.openApi
    ?? spec.openApiValidation;

  if (enabled === undefined || enabled === null) {
    return {
      pass: false, code: 'QA055',
      message: 'openApiSpec declared but validation against it is not enabled',
      detail: 'Add "validateAgainstOpenApi": true to enable schema validation.\nThis ensures contract interactions stay aligned with the OpenAPI contract.',
    };
  }

  if (enabled === false) {
    return {
      pass: false, code: 'QA055',
      message: 'validateAgainstOpenApi is false — OpenAPI spec is declared but not used for validation',
      detail: 'Set "validateAgainstOpenApi": true. Having an OpenAPI spec without validation creates two diverging sources of truth.',
    };
  }

  return { pass: true, code: 'QA055', message: `OpenAPI validation enabled — spec: ${spec.openApiSpec}` };
}
