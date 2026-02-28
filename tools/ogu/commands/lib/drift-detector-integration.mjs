/**
 * Drift Detector Integration — detect drift across spec/code/contracts/design.
 */

export const DRIFT_SOURCES = ['spec', 'contracts', 'ir', 'design', 'code'];

/**
 * Create a drift detector.
 *
 * @returns {object} Detector with addSource/detect/listSources
 */
export function createDriftDetector() {
  const sources = new Map(); // name → { hash, check }

  function addSource(name, { hash, check }) {
    sources.set(name, { name, hash, check });
  }

  function listSources() {
    return Array.from(sources.keys());
  }

  async function detect() {
    const results = [];
    let hasDrift = false;

    for (const [name, source] of sources) {
      const result = await source.check();
      results.push({
        name,
        hash: source.hash,
        drifted: result.drifted,
        details: result.details || null,
      });
      if (result.drifted) hasDrift = true;
    }

    return {
      hasDrift,
      sources: results,
      checkedAt: new Date().toISOString(),
    };
  }

  return { addSource, detect, listSources };
}
