/**
 * Diff Checker — governance-level analysis of file diffs.
 *
 * Detects dangerous patterns in code changes:
 *   - Secrets/credentials in additions
 *   - Mass file deletions
 *   - Changes to sensitive paths (.env, deploy/, etc.)
 *   - Hardcoded secrets (API keys, passwords, tokens)
 */

export const DANGEROUS_PATTERNS = {
  secrets: {
    paths: ['.env', '.env.local', '.env.production', 'secrets/', '.secret'],
    description: 'Changes to secret/credential files',
  },
  'mass-deletion': {
    threshold: 100,
    description: 'Deleting more than 100 lines in a single file',
  },
  'hardcoded-secret': {
    patterns: [
      /(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["'][^"']{6,}/i,
      /ghp_[a-zA-Z0-9]{36}/,
      /sk-[a-zA-Z0-9]{20,}/,
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
      /AKIA[0-9A-Z]{16}/,
    ],
    description: 'Hardcoded credentials or API keys in code',
  },
  'deploy-config': {
    paths: ['deploy/', 'production/', '.github/workflows/', 'Dockerfile', 'docker-compose'],
    description: 'Changes to deployment configuration',
  },
};

/**
 * Check a diff for dangerous patterns.
 *
 * @param {object} diff
 * @param {Array<{path: string, additions: string[], deletions: string[]}>} diff.files
 * @returns {{ approved: boolean, warnings: Array<{pattern: string, file: string, detail: string}> }}
 */
export function checkDiff(diff) {
  const warnings = [];

  for (const file of diff.files || []) {
    // Check sensitive file paths
    const isSecret = DANGEROUS_PATTERNS.secrets.paths.some(p =>
      file.path === p || file.path.startsWith(p)
    );
    if (isSecret) {
      warnings.push({
        pattern: 'secrets',
        file: file.path,
        detail: DANGEROUS_PATTERNS.secrets.description,
      });
    }

    // Check deploy config changes
    const isDeploy = DANGEROUS_PATTERNS['deploy-config'].paths.some(p =>
      file.path === p || file.path.startsWith(p)
    );
    if (isDeploy) {
      warnings.push({
        pattern: 'deploy-config',
        file: file.path,
        detail: DANGEROUS_PATTERNS['deploy-config'].description,
      });
    }

    // Check mass deletion
    if ((file.deletions || []).length >= DANGEROUS_PATTERNS['mass-deletion'].threshold) {
      warnings.push({
        pattern: 'mass-deletion',
        file: file.path,
        detail: `${file.deletions.length} lines deleted (threshold: ${DANGEROUS_PATTERNS['mass-deletion'].threshold})`,
      });
    }

    // Check hardcoded secrets in additions
    for (const line of (file.additions || [])) {
      for (const regex of DANGEROUS_PATTERNS['hardcoded-secret'].patterns) {
        if (regex.test(line)) {
          warnings.push({
            pattern: 'hardcoded-secret',
            file: file.path,
            detail: `Possible credential in: ${line.slice(0, 80)}`,
          });
          break; // One warning per line is enough
        }
      }
    }
  }

  return {
    approved: warnings.length === 0,
    warnings,
    fileCount: (diff.files || []).length,
  };
}
