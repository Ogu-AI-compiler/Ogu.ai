/**
 * Why:
 * Valid A/B test assignment must be random and verifiable. Two common failures:
 *
 * 1. BIASED ASSIGNMENT: `user_id % 2` assigns even IDs to control and odd to
 *    treatment. If even-ID users systematically differ (e.g., older accounts,
 *    different signup cohorts), the comparison is confounded.
 *    Correct pattern: hash-based assignment with a salt, e.g.:
 *    `int(hashlib.md5(f"{experiment_id}:{user_id}".encode()).hexdigest(), 16) % 100`
 *
 * 2. SAMPLE RATIO MISMATCH (SRM): Assignment should produce groups of the
 *    expected sizes (e.g., 50/50). If the realized split differs significantly
 *    from the expected ratio, the randomization mechanism is broken — logs may
 *    have been filtered, users double-counted, or assignment logic is wrong.
 *    Detect with a chi-squared test: chi2_contingency([[n_control, n_treatment]])
 *
 * Escape hatch: add `# @assignment-ok: <reason>` if the assignment mechanism
 * is handled externally (e.g., by a feature flag platform like LaunchDarkly).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BIASED_ASSIGNMENT_RE = /user_id\s*%\s*\d+|entity_id\s*%\s*\d+|id\s*%\s*2\b/i;
const HASH_ASSIGNMENT_RE   = /hashlib\.|mmh3\.|murmurhash|hash.*user_id|hash.*entity|assignment.*hash/i;
const RANDOM_SEED_RE       = /random\.seed|np\.random\.seed|random_state\s*=/;
const SRM_CHECK_RE         = /chi2_contingency|chi_square.*assign|sample.*ratio.*mismatch|SRM/i;

function readContent(dir) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  let out = '';
  for (const f of files) {
    const raw = readFileSync(join(dir, f), 'utf8');
    if (f.endsWith('.ipynb')) {
      try { out += (JSON.parse(raw).cells || []).map(c => (c.source || []).join('')).join('\n'); }
      catch { out += raw; }
    } else {
      out += raw;
    }
  }
  return out;
}

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  if (!files.length) return { pass: true, code: 'AB004', message: 'No Python files — skipped', skipped: true };

  const content = readContent(dir);

  if (/@assignment-ok/.test(content)) {
    return { pass: true, code: 'AB004', message: 'External assignment mechanism acknowledged via @assignment-ok' };
  }

  const violations = [];

  // Check for modulo-based (biased) assignment
  if (BIASED_ASSIGNMENT_RE.test(content) && !HASH_ASSIGNMENT_RE.test(content)) {
    violations.push(
      'Modulo-based assignment detected (e.g., user_id % 2) — hash-based randomization required.\n' +
      '  Use: int(hashlib.md5(f"{experiment_id}:{user_id}".encode()).hexdigest(), 16) % 100'
    );
  }

  // Check for SRM detection
  if (!SRM_CHECK_RE.test(content)) {
    violations.push(
      'No Sample Ratio Mismatch (SRM) check detected.\n' +
      '  Add: chi2, p = scipy.stats.chi2_contingency([[n_control, n_treatment]])\n' +
      '  If p < 0.01, the randomization is broken — do not interpret results.'
    );
  }

  if (violations.length) {
    return {
      pass: false, code: 'AB004',
      message: `${violations.length} assignment validity issue(s)`,
      detail: violations.join('\n\n') + '\n\nAdd # @assignment-ok: <reason> if assignment is handled externally.',
    };
  }

  return { pass: true, code: 'AB004', message: 'Hash-based assignment and SRM check present' };
}
