/**
 * Changelog Builder — build changelogs from commit history.
 */

/**
 * Create a changelog builder.
 *
 * @returns {object} Builder with addEntry/build
 */
export function createChangelogBuilder() {
  const entries = [];

  function addEntry({ type, description, version, date }) {
    entries.push({ type, description, version, date: date || new Date().toISOString().slice(0, 10) });
  }

  function build() {
    // Group by version
    const byVersion = new Map();
    for (const entry of entries) {
      if (!byVersion.has(entry.version)) byVersion.set(entry.version, []);
      byVersion.get(entry.version).push(entry);
    }

    // Sort versions descending
    const versions = Array.from(byVersion.keys()).sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      }
      return 0;
    });

    const lines = ['# Changelog', ''];
    for (const version of versions) {
      const vEntries = byVersion.get(version);
      lines.push(`## ${version}`);
      lines.push('');

      // Group by type
      const byType = new Map();
      for (const e of vEntries) {
        if (!byType.has(e.type)) byType.set(e.type, []);
        byType.get(e.type).push(e);
      }

      for (const [type, typeEntries] of byType) {
        lines.push(`### ${type}`);
        for (const e of typeEntries) {
          lines.push(`- ${e.description}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  return { addEntry, build };
}
