/**
 * Audit Rotator — rotate audit log daily to YYYY-MM-DD.jsonl.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Create an audit rotator.
 *
 * @param {{ dir: string }} opts - Audit directory
 * @returns {object} Rotator with rotate/listArchives
 */
export function createAuditRotator({ dir }) {
  const currentPath = join(dir, 'current.jsonl');

  async function rotate(dateLabel) {
    if (!existsSync(currentPath)) {
      return { rotated: false, reason: 'no current.jsonl' };
    }

    const content = readFileSync(currentPath, 'utf-8').trim();
    if (!content) {
      return { rotated: false, reason: 'empty log' };
    }

    const archivePath = join(dir, `${dateLabel}.jsonl`);
    writeFileSync(archivePath, content + '\n');
    writeFileSync(currentPath, '');

    return {
      rotated: true,
      archive: archivePath,
      events: content.split('\n').length,
    };
  }

  async function listArchives() {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.jsonl$/))
      .sort();
  }

  return { rotate, listArchives };
}
