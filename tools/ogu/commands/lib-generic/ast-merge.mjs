/**
 * AST Merge — line-level three-way merge with conflict detection.
 */

/**
 * Three-way merge of text content.
 *
 * @param {string} base - Original content
 * @param {string} branchA - First branch changes
 * @param {string} branchB - Second branch changes
 * @returns {{ merged: boolean, content?: string, conflicts?: Array }}
 */
export function mergeCode(base, branchA, branchB) {
  const baseLines = base.split('\n');
  const aLines = branchA.split('\n');
  const bLines = branchB.split('\n');
  const maxLen = Math.max(baseLines.length, aLines.length, bLines.length);
  const result = [];
  const conflicts = [];

  for (let i = 0; i < maxLen; i++) {
    const baseLine = baseLines[i] ?? '';
    const aLine = aLines[i] ?? '';
    const bLine = bLines[i] ?? '';

    const aChanged = aLine !== baseLine;
    const bChanged = bLine !== baseLine;

    if (!aChanged && !bChanged) {
      result.push(baseLine);
    } else if (aChanged && !bChanged) {
      result.push(aLine);
    } else if (!aChanged && bChanged) {
      result.push(bLine);
    } else if (aLine === bLine) {
      // Both changed to same thing
      result.push(aLine);
    } else {
      // Conflict
      conflicts.push({ line: i + 1, base: baseLine, branchA: aLine, branchB: bLine });
      result.push(baseLine); // Keep base on conflict
    }
  }

  if (conflicts.length > 0) {
    return { merged: false, conflicts };
  }
  return { merged: true, content: result.join('\n') };
}

/**
 * Detect semantic conflicts from overlapping file/line edits.
 *
 * @param {Array<{ file: string, lines: number[] }>} changes
 * @returns {Array<{ file: string, overlappingLines: number[] }>}
 */
export function detectSemanticConflicts(changes) {
  const conflicts = [];
  for (let i = 0; i < changes.length; i++) {
    for (let j = i + 1; j < changes.length; j++) {
      if (changes[i].file !== changes[j].file) continue;
      const overlap = changes[i].lines.filter(l => changes[j].lines.includes(l));
      if (overlap.length > 0) {
        conflicts.push({ file: changes[i].file, overlappingLines: overlap });
      }
    }
  }
  return conflicts;
}
