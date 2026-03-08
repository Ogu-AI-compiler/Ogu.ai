/**
 * Version Tracker — semantic versioning with changelog generation.
 */

/**
 * Parse a semver string into components.
 *
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number }}
 */
export function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major: major || 0, minor: minor || 0, patch: patch || 0 };
}

/**
 * Create a version tracker.
 *
 * @param {{ initial?: string }} opts
 * @returns {object} Tracker with bump/getVersion/getChangelog
 */
export function createVersionTracker({ initial = '0.0.0' } = {}) {
  let { major, minor, patch } = parseVersion(initial);
  const changelog = [];

  function bump(type, description = '') {
    switch (type) {
      case 'major':
        major++;
        minor = 0;
        patch = 0;
        break;
      case 'minor':
        minor++;
        patch = 0;
        break;
      case 'patch':
      default:
        patch++;
        break;
    }
    const version = `${major}.${minor}.${patch}`;
    changelog.push({
      version,
      type,
      description,
      timestamp: new Date().toISOString(),
    });
    return version;
  }

  function getVersion() {
    return `${major}.${minor}.${patch}`;
  }

  function getChangelog() {
    return [...changelog];
  }

  return { bump, getVersion, getChangelog };
}
