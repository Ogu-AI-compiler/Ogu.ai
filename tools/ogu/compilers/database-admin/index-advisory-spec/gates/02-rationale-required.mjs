/**
 * Gate: rationale-required (IAS002)
 * Every "add" index action must have a rationale field explaining why this
 * index is needed. Indexes are not free — they add write overhead to every
 * INSERT, UPDATE, and DELETE. An unexplained index will be forgotten and never
 * evaluated for removal when it becomes unused.
 *
 * The rationale must be a non-empty, non-vague string.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VAGUE_RATIONALES = ['performance', 'speed', 'fast', 'needed', 'required', 'tbd', 'todo', 'see ticket', 'optimization'];

export async function run({ dir }) {
  const specPath = join(dir, 'index-advisory-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'IAS002', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'IAS002', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.indexes)) {
    return { pass: true, code: 'IAS002', message: 'No indexes array — gate skipped', skipped: true };
  }

  const addIndexes = spec.indexes.filter(i => i.action === 'add');

  if (addIndexes.length === 0) {
    return {
      pass: true,
      code: 'IAS002',
      message: 'No "add" index actions — rationale check skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const idx of addIndexes) {
    const label = `indexes[table: "${idx.table}", columns: ${JSON.stringify(idx.columns)}]`;

    if (!idx.rationale || typeof idx.rationale !== 'string' || idx.rationale.trim() === '') {
      violations.push(`${label}: "rationale" is required for all "add" index actions`);
      continue;
    }

    const lower = idx.rationale.toLowerCase().trim();
    if (VAGUE_RATIONALES.includes(lower)) {
      violations.push(
        `${label}: rationale "${idx.rationale}" is too vague. ` +
        'Explain the specific query pattern this index supports (e.g., "users lookup by email for login — 10k RPM OLTP query").'
      );
    } else if (idx.rationale.length < 20) {
      violations.push(
        `${label}: rationale "${idx.rationale}" is too short (${idx.rationale.length} chars). ` +
        'Provide a meaningful explanation of the query pattern this index supports.'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'IAS002',
      message: `${violations.length} "add" index action(s) missing or have inadequate rationale`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'IAS002',
    message: `All ${addIndexes.length} "add" index action(s) have adequate rationale`,
  };
}
