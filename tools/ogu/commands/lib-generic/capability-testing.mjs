/**
 * Capability Testing — test runner for agent capabilities.
 */

/**
 * Score a capability based on test results.
 *
 * @param {{ total: number, passed: number }} results
 * @returns {number} Score 0-100
 */
export function scoreCapability({ total, passed }) {
  if (total === 0) return 0;
  return Math.round((passed / total) * 100);
}

/**
 * Create a capability test runner.
 *
 * @returns {object} Runner with addTest/run/listTests/getResults
 */
export function createCapabilityRunner() {
  const tests = [];
  let lastResults = null;

  function addTest({ capability, test, description = '' }) {
    tests.push({ capability, test, description });
  }

  function listTests() {
    return tests.map(t => ({ capability: t.capability, description: t.description }));
  }

  async function run() {
    let passed = 0;
    let failed = 0;
    const details = [];

    for (const t of tests) {
      try {
        await t.test();
        passed++;
        details.push({ capability: t.capability, status: 'pass' });
      } catch (e) {
        failed++;
        details.push({ capability: t.capability, status: 'fail', error: e.message });
      }
    }

    lastResults = {
      total: tests.length,
      passed,
      failed,
      score: scoreCapability({ total: tests.length, passed }),
      details,
    };
    return lastResults;
  }

  function getResults() {
    return lastResults;
  }

  return { addTest, listTests, run, getResults };
}
