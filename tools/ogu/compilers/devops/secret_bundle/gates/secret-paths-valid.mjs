/**
 * Gate: secret-paths-valid (SB005)
 * Validates that each secret's path field conforms to the expected format for its
 * declared source. An incorrectly formatted path will cause a runtime lookup failure
 * when the application starts — failing here is better than failing in production.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

/** Regex for the expected path format per secret source */
const PATH_PATTERNS = {
  'aws-secrets-manager': /^arn:aws:secretsmanager:[a-z0-9-]+:\d{12}:secret:[a-zA-Z0-9/_+=.@-]+$|^[a-zA-Z0-9/_+=.@-]+$/,
  'gcp-secret-manager':  /^projects\/[^/]+\/secrets\/[^/]+(\/versions\/[^/]+)?$/,
  'azure-key-vault':     /^https:\/\/[a-z0-9-]+\.vault\.azure\.net\/secrets\/[^/]+(\/[^/]+)?$/,
  'vault':               /^[a-zA-Z0-9_/-]+$/,
  'k8s-secret':          /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/,
  'sealed-secret':       null, // sealed-secret references are managed by the controller, no path needed
};

const PATH_EXAMPLES = {
  'aws-secrets-manager': 'my-app/db-password or arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
  'gcp-secret-manager':  'projects/my-project/secrets/my-secret/versions/latest',
  'azure-key-vault':     'https://my-vault.vault.azure.net/secrets/my-secret',
  'vault':               'secret/data/my-app/db',
  'k8s-secret':          'default/my-k8s-secret',
};

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'secret-bundle-spec.json'), 'utf8'));
  const violations = [];

  for (const secret of spec.secrets) {
    const pattern = PATH_PATTERNS[secret.source];
    if (pattern === null) continue;    // sealed-secret: no path needed
    if (pattern === undefined) continue; // unknown source: caught by spec-valid

    if (!secret.path || secret.path.trim() === '') {
      violations.push({
        name:    secret.name,
        source:  secret.source,
        reason:  'missing path — every secret must declare where to fetch the value from',
        example: PATH_EXAMPLES[secret.source],
      });
      continue;
    }

    if (!pattern.test(secret.path)) {
      violations.push({
        name:    secret.name,
        source:  secret.source,
        path:    secret.path,
        reason:  `path format is invalid for source "${secret.source}"`,
        example: PATH_EXAMPLES[secret.source],
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SB005',
      message: `${violations.length} invalid secret path(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'SB005',
    message: `All ${spec.secrets.length} secret paths are syntactically valid`,
  };
}
