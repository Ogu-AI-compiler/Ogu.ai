/**
 * A/B Test Framework — variant assignment and result tracking.
 */

/**
 * Simple deterministic hash for consistent assignment.
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Create an A/B experiment.
 *
 * @param {{ id: string, variants: { id: string, weight: number }[] }} opts
 * @returns {object} Experiment with assign/recordResult/getResults
 */
export function createExperiment({ id, variants }) {
  const totalWeight = variants.reduce((s, v) => s + v.weight, 0);
  const results = new Map(); // subjectId -> { variant, result }

  function assign(subjectId) {
    const hash = hashCode(`${id}:${subjectId}`);
    const bucket = hash % totalWeight;
    let cumulative = 0;
    for (const v of variants) {
      cumulative += v.weight;
      if (bucket < cumulative) return v.id;
    }
    return variants[variants.length - 1].id;
  }

  function recordResult(subjectId, result) {
    const variant = assign(subjectId);
    results.set(subjectId, { variant, ...result });
  }

  function getResults() {
    const byVariant = {};
    for (const v of variants) {
      byVariant[v.id] = { samples: 0, results: [] };
    }

    for (const [subjectId, data] of results) {
      const { variant, ...rest } = data;
      if (byVariant[variant]) {
        byVariant[variant].samples++;
        byVariant[variant].results.push(rest);
      }
    }

    return {
      experimentId: id,
      totalSamples: results.size,
      byVariant,
    };
  }

  return { assign, recordResult, getResults };
}
