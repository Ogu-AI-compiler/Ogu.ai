/**
 * Changelog Generator — generate changelogs from commit-style entries.
 */
export function createChangelogGenerator() {
  const entries = [];
  function addEntry(type, message, scope = '') {
    entries.push({ type, message, scope, date: new Date().toISOString().slice(0, 10) });
  }
  function generate(version) {
    const groups = {};
    for (const e of entries) {
      if (!groups[e.type]) groups[e.type] = [];
      groups[e.type].push(e);
    }
    let md = `## ${version}\n\n`;
    for (const [type, items] of Object.entries(groups)) {
      md += `### ${type}\n`;
      for (const item of items) {
        md += `- ${item.scope ? `**${item.scope}**: ` : ''}${item.message}\n`;
      }
      md += '\n';
    }
    return md;
  }
  function clear() { entries.length = 0; }
  function count() { return entries.length; }
  return { addEntry, generate, clear, count };
}
