import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Audit Rotation — move events to daily YYYY-MM-DD.jsonl files.
 */

/**
 * Rotate current.jsonl into dated files.
 * Events are grouped by date and appended to the appropriate file.
 * current.jsonl is then cleared.
 *
 * @param {object} opts
 * @param {string} [opts.root]
 * @returns {{ rotatedCount: number, datesCreated: number }}
 */
export function rotateAuditLog({ root } = {}) {
  root = root || repoRoot();
  const currentPath = join(root, '.ogu/audit/current.jsonl');

  if (!existsSync(currentPath)) {
    return { rotatedCount: 0, datesCreated: 0 };
  }

  const content = readFileSync(currentPath, 'utf8').trim();
  if (!content) {
    return { rotatedCount: 0, datesCreated: 0 };
  }

  const lines = content.split('\n').filter(Boolean);
  const byDate = {};

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      const date = event.timestamp ? event.timestamp.slice(0, 10) : 'unknown';
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(line);
    } catch { /* skip malformed */ }
  }

  const datesCreated = Object.keys(byDate).length;

  for (const [date, dateLines] of Object.entries(byDate)) {
    const datePath = join(root, `.ogu/audit/${date}.jsonl`);
    appendFileSync(datePath, dateLines.join('\n') + '\n');
  }

  // Clear current.jsonl
  writeFileSync(currentPath, '');

  return {
    rotatedCount: lines.length,
    datesCreated,
  };
}
