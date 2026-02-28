/**
 * Functional Determinism Tolerance — non-determinism measurement and classification.
 *
 * Measures output similarity between expected and actual results,
 * classifies divergence types, and checks against tolerance levels.
 */

/**
 * Tolerance level thresholds.
 */
export const TOLERANCE_LEVELS = {
  strict: {
    threshold: 0.99,
    description: 'Byte-identical output required',
  },
  normal: {
    threshold: 0.90,
    description: 'Minor whitespace and formatting differences allowed',
  },
  relaxed: {
    threshold: 0.70,
    description: 'Semantically equivalent output accepted',
  },
  permissive: {
    threshold: 0.40,
    description: 'Broadly similar output accepted',
  },
};

/**
 * Compute divergence between expected and actual output.
 *
 * Uses token-level comparison for a similarity score.
 *
 * @param {object} opts
 * @param {string} opts.expected
 * @param {string} opts.actual
 * @returns {{ score: number, divergent: boolean, matchedTokens: number, totalTokens: number }}
 */
export function computeDivergence({ expected, actual } = {}) {
  if (expected === actual) {
    return { score: 1.0, divergent: false, matchedTokens: 0, totalTokens: 0 };
  }

  const expectedTokens = tokenize(expected);
  const actualTokens = tokenize(actual);

  const totalTokens = Math.max(expectedTokens.length, actualTokens.length);
  if (totalTokens === 0) {
    return { score: 1.0, divergent: false, matchedTokens: 0, totalTokens: 0 };
  }

  // LCS-based similarity
  const lcsLen = lcsLength(expectedTokens, actualTokens);
  const score = lcsLen / totalTokens;

  return {
    score: Math.round(score * 1000) / 1000,
    divergent: score < 0.99,
    matchedTokens: lcsLen,
    totalTokens,
  };
}

/**
 * Classify divergence type between expected and actual.
 *
 * @param {object} opts
 * @param {string} opts.expected
 * @param {string} opts.actual
 * @returns {{ type: 'identical' | 'cosmetic' | 'structural' | 'semantic', details: string }}
 */
export function classifyDivergence({ expected, actual } = {}) {
  if (expected === actual) {
    return { type: 'identical', details: 'Byte-identical output' };
  }

  // Check if only whitespace differs
  const normalizedExpected = expected.replace(/\s+/g, ' ').trim();
  const normalizedActual = actual.replace(/\s+/g, ' ').trim();

  if (normalizedExpected === normalizedActual) {
    return { type: 'cosmetic', details: 'Only whitespace differences' };
  }

  // Check if same tokens but different order/structure
  const { score } = computeDivergence({ expected, actual });

  if (score >= 0.8) {
    return { type: 'structural', details: `High similarity (${score}), structural rearrangement` };
  }

  return { type: 'semantic', details: `Low similarity (${score}), semantically different` };
}

/**
 * Check if a similarity score is within a tolerance level.
 *
 * @param {number} score - Similarity score (0-1)
 * @param {string} level - Tolerance level name
 * @returns {boolean}
 */
export function isWithinTolerance(score, level) {
  const config = TOLERANCE_LEVELS[level] || TOLERANCE_LEVELS.normal;
  return score >= config.threshold;
}

// ── Helpers ──

function tokenize(str) {
  return str.split(/[\s{}()[\];,=<>+\-*/&|!?:."'`]+/).filter(Boolean);
}

function lcsLength(a, b) {
  const m = a.length;
  const n = b.length;

  // Space-optimized LCS
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return prev[n];
}
