/**
 * Commit Message Generator — generate conventional commit messages.
 */

/**
 * Generate a conventional commit message.
 *
 * @param {object} opts - { type, scope?, description, breaking? }
 * @returns {string} Formatted commit message
 */
export function generateCommitMessage({ type, scope, description, breaking }) {
  const breakingMark = breaking ? '!' : '';
  const scopePart = scope ? `(${scope})` : '';
  return `${type}${scopePart}${breakingMark}: ${description}`;
}

/**
 * Format a commit body with details.
 *
 * @param {object} opts - { description, filesChanged?, agent? }
 * @returns {string} Formatted body
 */
export function formatCommitBody({ description, filesChanged = [], agent }) {
  const lines = [description, ''];
  if (filesChanged.length > 0) {
    lines.push('Files changed:');
    for (const f of filesChanged) lines.push(`  - ${f}`);
  }
  if (agent) lines.push(`\nAgent: ${agent}`);
  return lines.join('\n');
}
