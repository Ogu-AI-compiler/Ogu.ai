import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * SR006 — errors-typed
 * Non-2xx responses must be normalized into typed client errors.
 * Pattern: ClientError, HttpError, ServiceError classes with status and body.
 */

const TYPED_ERROR_PATTERNS = [
  /class\s+\w*(Error|Exception)\s+extends\s+Error/,
  /new\s+\w*(Error|Exception)\s*\(/,
  /instanceof\s+\w*(Error|Exception)/,
];

const STATUS_CHECK_PATTERNS = [
  /response\.ok/,
  /response\.status\s*[><!]=?\s*[0-9]/,
  /status\s*>=?\s*400/,
  /!ok\b/,
];

const ERROR_BODY_PATTERNS = [
  /response\.json\(\)/,
  /response\.text\(\)/,
  /errorBody|error\.body|error\.message/,
];

function findErrorFiles(dir) {
  const candidates = [
    join(dir, 'src', 'lib', 'http', 'errors.ts'),
    join(dir, 'src', 'lib', 'http', 'error.ts'),
    join(dir, 'src', 'http', 'errors.ts'),
    join(dir, 'lib', 'http', 'errors.ts'),
  ];
  return candidates.filter(existsSync);
}

export async function run({ dir }) {
  const errorFiles = findErrorFiles(dir);

  if (errorFiles.length === 0) {
    // Check if errors are defined inline in httpClient.ts
    const httpClientCandidates = [
      join(dir, 'src', 'lib', 'http', 'httpClient.ts'),
      join(dir, 'src', 'http', 'httpClient.ts'),
    ];
    const httpContent = httpClientCandidates
      .filter(existsSync)
      .map(f => readFileSync(f, 'utf8'))
      .join('\n');

    if (!httpContent) {
      return {
        pass: false, code: 'SR006',
        message: 'No error type definitions and no httpClient.ts found',
        detail: 'Create src/lib/http/errors.ts with typed error classes (HttpClientError, ServiceUnavailableError, etc.)'
      };
    }

    const hasTypedErrors = TYPED_ERROR_PATTERNS.some(p => p.test(httpContent));
    const hasStatusCheck = STATUS_CHECK_PATTERNS.some(p => p.test(httpContent));

    if (!hasTypedErrors || !hasStatusCheck) {
      return {
        pass: false, code: 'SR006',
        message: 'HTTP client does not map non-2xx responses to typed errors',
        detail: 'Add: if (!response.ok) { throw new HttpClientError(response.status, await response.json()); }'
      };
    }

    return { pass: true, code: 'SR006', message: 'Non-2xx responses mapped to typed errors in httpClient.ts' };
  }

  const errorContent = errorFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const hasTypedErrors = TYPED_ERROR_PATTERNS.some(p => p.test(errorContent));

  if (!hasTypedErrors) {
    return {
      pass: false, code: 'SR006',
      message: 'errors.ts exists but defines no typed error classes',
      detail: 'Add: export class HttpClientError extends Error { constructor(public status: number, public body: unknown) { super() } }'
    };
  }

  return {
    pass: true, code: 'SR006',
    message: `Typed error classes defined in ${errorFiles.map(f => f.replace(dir + '/', '')).join(', ')}`
  };
}
