/**
 * AST Merge — structural file merging and conflict detection.
 *
 * Uses regex-based block detection (not a real parser) to split
 * JS/TS/JSON files into logical blocks (imports, functions, classes,
 * exports) and perform three-way merge at the block level.
 *
 * This enables smarter conflict detection than line-based diff:
 * two agents modifying different functions in the same file is NOT
 * a conflict; two agents modifying the same function IS.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// ── Language Detection ───────────────────────────────────────────────

const LANGUAGE_MAP = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.css': 'css',
  '.html': 'html',
  '.md': 'markdown',
  '.py': 'python',
};

function detectLanguage(filenameOrLang) {
  if (!filenameOrLang) return 'unknown';
  // If already a language name
  if (Object.values(LANGUAGE_MAP).includes(filenameOrLang)) return filenameOrLang;
  // Try extension lookup
  for (const [ext, lang] of Object.entries(LANGUAGE_MAP)) {
    if (filenameOrLang.endsWith(ext)) return lang;
  }
  return 'unknown';
}

// ── Block Hashing ────────────────────────────────────────────────────

/**
 * Hash a code block for identity comparison.
 *
 * @param {string} content - Block content
 * @returns {string} SHA-256 hex hash
 */
export function blockHash(content) {
  return createHash('sha256').update(content.trim()).digest('hex');
}

// ── Block Extraction ─────────────────────────────────────────────────

/**
 * Split file content into logical blocks.
 *
 * For JS/TS: identifies imports, exports, functions, classes, and
 * remaining code blocks. Uses regex-based detection.
 *
 * @param {string} content - File content
 * @param {string} language - Language name or file extension
 * @returns {Array<{ type: string, name: string, start: number, end: number, content: string, hash: string }>}
 */
export function extractBlocks(content, language) {
  const lang = detectLanguage(language);

  if (lang === 'json') return extractJSONBlocks(content);
  if (lang === 'css') return extractCSSBlocks(content);
  if (lang === 'javascript' || lang === 'typescript') return extractJSBlocks(content);
  if (lang === 'python') return extractPythonBlocks(content);

  // Fallback: treat entire file as one block
  return [{
    type: 'raw',
    name: 'file',
    start: 0,
    end: content.length,
    content,
    hash: blockHash(content),
  }];
}

function extractJSBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Import block
    if (/^import\s/.test(trimmed)) {
      const start = i;
      let blockContent = line;
      // Multi-line imports
      while (i < lines.length - 1 && !lines[i].includes(';') && !lines[i].includes("'") && !/from\s/.test(lines[i])) {
        i++;
        blockContent += '\n' + lines[i];
      }
      if (!blockContent.includes(';') && i < lines.length - 1) {
        i++;
        blockContent += '\n' + lines[i];
      }
      blocks.push({ type: 'import', name: extractImportName(blockContent), start, end: i, content: blockContent, hash: blockHash(blockContent) });
      i++;
      continue;
    }

    // Export default function/class
    if (/^export\s+default\s+(function|class)\s/.test(trimmed)) {
      const match = trimmed.match(/^export\s+default\s+(function|class)\s+(\w+)/);
      const name = match ? match[2] : 'default';
      const { block, endLine } = extractBracedBlock(lines, i);
      blocks.push({ type: 'export-default', name, start: i, end: endLine, content: block, hash: blockHash(block) });
      i = endLine + 1;
      continue;
    }

    // Named export function/class/const
    if (/^export\s+(async\s+)?function\s/.test(trimmed) || /^export\s+class\s/.test(trimmed)) {
      const match = trimmed.match(/^export\s+(?:async\s+)?(?:function|class)\s+(\w+)/);
      const name = match ? match[1] : 'anonymous';
      const { block, endLine } = extractBracedBlock(lines, i);
      blocks.push({ type: 'export-function', name, start: i, end: endLine, content: block, hash: blockHash(block) });
      i = endLine + 1;
      continue;
    }

    if (/^export\s+(const|let|var)\s/.test(trimmed)) {
      const match = trimmed.match(/^export\s+(?:const|let|var)\s+(\w+)/);
      const name = match ? match[1] : 'anonymous';
      // Could be single-line or multi-line
      if (trimmed.includes('{') || trimmed.includes('[') || trimmed.includes('`')) {
        const { block, endLine } = extractBracedBlock(lines, i);
        blocks.push({ type: 'export-const', name, start: i, end: endLine, content: block, hash: blockHash(block) });
        i = endLine + 1;
      } else {
        blocks.push({ type: 'export-const', name, start: i, end: i, content: line, hash: blockHash(line) });
        i++;
      }
      continue;
    }

    // Standalone function/class
    if (/^(async\s+)?function\s/.test(trimmed) || /^class\s/.test(trimmed)) {
      const match = trimmed.match(/^(?:async\s+)?(?:function|class)\s+(\w+)/);
      const name = match ? match[1] : 'anonymous';
      const { block, endLine } = extractBracedBlock(lines, i);
      blocks.push({ type: trimmed.startsWith('class') ? 'class' : 'function', name, start: i, end: endLine, content: block, hash: blockHash(block) });
      i = endLine + 1;
      continue;
    }

    // Const/let/var declarations (top-level)
    if (/^(const|let|var)\s/.test(trimmed)) {
      const match = trimmed.match(/^(?:const|let|var)\s+(\w+)/);
      const name = match ? match[1] : 'anonymous';
      if (trimmed.includes('{') && !trimmed.includes('}')) {
        const { block, endLine } = extractBracedBlock(lines, i);
        blocks.push({ type: 'declaration', name, start: i, end: endLine, content: block, hash: blockHash(block) });
        i = endLine + 1;
      } else {
        blocks.push({ type: 'declaration', name, start: i, end: i, content: line, hash: blockHash(line) });
        i++;
      }
      continue;
    }

    // Comment blocks
    if (/^\/\*\*/.test(trimmed) || /^\/\//.test(trimmed)) {
      const start = i;
      let blockContent = line;
      if (trimmed.startsWith('/**') || trimmed.startsWith('/*')) {
        while (i < lines.length - 1 && !lines[i].includes('*/')) {
          i++;
          blockContent += '\n' + lines[i];
        }
      }
      blocks.push({ type: 'comment', name: `comment_${start}`, start, end: i, content: blockContent, hash: blockHash(blockContent) });
      i++;
      continue;
    }

    // Blank/whitespace lines — skip
    if (trimmed === '') {
      i++;
      continue;
    }

    // Catch-all: miscellaneous line
    blocks.push({ type: 'misc', name: `line_${i}`, start: i, end: i, content: line, hash: blockHash(line) });
    i++;
  }

  return blocks;
}

function extractBracedBlock(lines, startLine) {
  let depth = 0;
  let i = startLine;
  let block = '';
  let foundOpen = false;

  while (i < lines.length) {
    block += (i === startLine ? '' : '\n') + lines[i];

    for (const ch of lines[i]) {
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') depth--;
    }

    if (foundOpen && depth <= 0) break;
    i++;
  }

  return { block, endLine: i };
}

function extractImportName(content) {
  const match = content.match(/from\s+['"]([^'"]+)['"]/);
  return match ? match[1] : 'unknown';
}

function extractJSONBlocks(content) {
  try {
    const obj = JSON.parse(content);
    return Object.keys(obj).map((key, idx) => {
      const val = JSON.stringify(obj[key], null, 2);
      return { type: 'property', name: key, start: idx, end: idx, content: val, hash: blockHash(val) };
    });
  } catch {
    return [{ type: 'raw', name: 'file', start: 0, end: 0, content, hash: blockHash(content) }];
  }
}

function extractCSSBlocks(content) {
  const blocks = [];
  const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
  let match;
  let idx = 0;

  while ((match = ruleRegex.exec(content)) !== null) {
    const selector = match[1].trim();
    const full = match[0];
    blocks.push({ type: 'rule', name: selector, start: idx, end: idx, content: full, hash: blockHash(full) });
    idx++;
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'raw', name: 'file', start: 0, end: 0, content, hash: blockHash(content) });
  }

  return blocks;
}

function extractPythonBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (/^(def|class|async\s+def)\s/.test(trimmed)) {
      const match = trimmed.match(/^(?:async\s+)?(?:def|class)\s+(\w+)/);
      const name = match ? match[1] : 'anonymous';
      const start = i;
      const indent = line.length - line.trimStart().length;
      let blockContent = line;
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trimStart();
        const nextIndent = nextLine.length - nextTrimmed.length;
        if (nextTrimmed === '' || nextIndent > indent) {
          blockContent += '\n' + nextLine;
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: trimmed.startsWith('class') ? 'class' : 'function', name, start, end: i - 1, content: blockContent, hash: blockHash(blockContent) });
      continue;
    }

    if (/^import\s|^from\s/.test(trimmed)) {
      blocks.push({ type: 'import', name: trimmed, start: i, end: i, content: line, hash: blockHash(line) });
      i++;
      continue;
    }

    if (trimmed === '') { i++; continue; }

    blocks.push({ type: 'misc', name: `line_${i}`, start: i, end: i, content: line, hash: blockHash(line) });
    i++;
  }

  return blocks;
}

// ── AST Diff ─────────────────────────────────────────────────────────

/**
 * Compute structural diff between two file contents.
 *
 * Compares at the block level: identifies added, removed, modified,
 * and unchanged blocks.
 *
 * @param {string} content1 - Original content
 * @param {string} content2 - Modified content
 * @param {string} language - Language name or file extension
 * @returns {{ added: object[], removed: object[], modified: object[], unchanged: object[] }}
 */
export function computeASTDiff(content1, content2, language) {
  const blocks1 = extractBlocks(content1, language);
  const blocks2 = extractBlocks(content2, language);

  const map1 = new Map(blocks1.map(b => [`${b.type}:${b.name}`, b]));
  const map2 = new Map(blocks2.map(b => [`${b.type}:${b.name}`, b]));

  const added = [];
  const removed = [];
  const modified = [];
  const unchanged = [];

  // Find removed and modified
  for (const [key, block] of map1) {
    const other = map2.get(key);
    if (!other) {
      removed.push(block);
    } else if (block.hash !== other.hash) {
      modified.push({ before: block, after: other });
    } else {
      unchanged.push(block);
    }
  }

  // Find added
  for (const [key, block] of map2) {
    if (!map1.has(key)) {
      added.push(block);
    }
  }

  return { added, removed, modified, unchanged };
}

// ── Three-Way Merge ──────────────────────────────────────────────────

/**
 * Detect conflicts in a three-way merge at the AST block level.
 *
 * @param {string} base - Base content (common ancestor)
 * @param {string} ours - Our changes
 * @param {string} theirs - Their changes
 * @returns {{ conflicts: object[], autoMergeable: object[], conflictBlocks: string[] }}
 */
export function detectASTConflicts(base, ours, theirs) {
  const lang = 'javascript'; // Default — caller should provide if known
  const baseBlocks = extractBlocks(base, lang);
  const ourBlocks = extractBlocks(ours, lang);
  const theirBlocks = extractBlocks(theirs, lang);

  const baseMap = new Map(baseBlocks.map(b => [`${b.type}:${b.name}`, b]));
  const ourMap = new Map(ourBlocks.map(b => [`${b.type}:${b.name}`, b]));
  const theirMap = new Map(theirBlocks.map(b => [`${b.type}:${b.name}`, b]));

  const allKeys = new Set([...baseMap.keys(), ...ourMap.keys(), ...theirMap.keys()]);

  const conflicts = [];
  const autoMergeable = [];
  const conflictBlocks = [];

  for (const key of allKeys) {
    const baseBlock = baseMap.get(key);
    const ourBlock = ourMap.get(key);
    const theirBlock = theirMap.get(key);

    const baseHash = baseBlock?.hash || null;
    const ourHash = ourBlock?.hash || null;
    const theirHash = theirBlock?.hash || null;

    // Both unchanged from base
    if (ourHash === baseHash && theirHash === baseHash) continue;

    // Only we changed
    if (ourHash !== baseHash && theirHash === baseHash) {
      autoMergeable.push({ key, source: 'ours', block: ourBlock });
      continue;
    }

    // Only they changed
    if (ourHash === baseHash && theirHash !== baseHash) {
      autoMergeable.push({ key, source: 'theirs', block: theirBlock });
      continue;
    }

    // Both changed — conflict if different, auto-merge if same
    if (ourHash === theirHash) {
      autoMergeable.push({ key, source: 'both-same', block: ourBlock });
    } else {
      conflicts.push({ key, base: baseBlock, ours: ourBlock, theirs: theirBlock });
      conflictBlocks.push(key);
    }
  }

  return { conflicts, autoMergeable, conflictBlocks };
}

/**
 * Attempt automatic three-way merge.
 *
 * For blocks where only one side changed, take that change.
 * For blocks where both changed identically, take either.
 * For true conflicts, include conflict markers.
 *
 * @param {string} base - Base content
 * @param {string} ours - Our changes
 * @param {string} theirs - Their changes
 * @returns {{ merged: string, conflicts: number, success: boolean }}
 */
export function mergeFileAST(base, ours, theirs) {
  const { conflicts, autoMergeable, conflictBlocks } = detectASTConflicts(base, ours, theirs);
  const lang = 'javascript';

  const baseBlocks = extractBlocks(base, lang);
  const ourBlocks = extractBlocks(ours, lang);
  const theirBlocks = extractBlocks(theirs, lang);

  const baseMap = new Map(baseBlocks.map(b => [`${b.type}:${b.name}`, b]));
  const ourMap = new Map(ourBlocks.map(b => [`${b.type}:${b.name}`, b]));
  const theirMap = new Map(theirBlocks.map(b => [`${b.type}:${b.name}`, b]));

  // Build merged output preserving order from "ours" with additions from "theirs"
  const mergedParts = [];
  const handled = new Set();

  // Process blocks in the order they appear in "ours"
  for (const block of ourBlocks) {
    const key = `${block.type}:${block.name}`;
    handled.add(key);

    const autoEntry = autoMergeable.find(m => m.key === key);
    const conflictEntry = conflicts.find(c => c.key === key);

    if (conflictEntry) {
      // True conflict — add markers
      mergedParts.push(`<<<<<<< OURS`);
      mergedParts.push(conflictEntry.ours?.content || '');
      mergedParts.push(`=======`);
      mergedParts.push(conflictEntry.theirs?.content || '');
      mergedParts.push(`>>>>>>> THEIRS`);
    } else if (autoEntry) {
      mergedParts.push(autoEntry.block.content);
    } else {
      mergedParts.push(block.content);
    }
  }

  // Add blocks only in "theirs" (new additions)
  for (const block of theirBlocks) {
    const key = `${block.type}:${block.name}`;
    if (!handled.has(key) && !baseMap.has(key)) {
      mergedParts.push(block.content);
    }
  }

  return {
    merged: mergedParts.join('\n'),
    conflicts: conflictBlocks.length,
    success: conflictBlocks.length === 0,
  };
}

// ── Line-based merge (simple three-way) ─────────────────────────────

/**
 * Simple line-based three-way merge.
 *
 * @param {string} base - Common ancestor content
 * @param {string} branchA - First branch changes
 * @param {string} branchB - Second branch changes
 * @returns {{ merged: boolean, content: string, conflicts: Array<{ line: number, a: string, b: string }> }}
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
      // Both changed to the same thing
      result.push(aLine);
    } else {
      // True conflict
      conflicts.push({ line: i, a: aLine, b: bLine });
      result.push(`<<<<<<< A`);
      result.push(aLine);
      result.push(`=======`);
      result.push(bLine);
      result.push(`>>>>>>> B`);
    }
  }

  return {
    merged: conflicts.length === 0,
    content: result.join('\n'),
    conflicts,
  };
}

/**
 * Detect semantic conflicts: overlapping line ranges in the same file.
 *
 * @param {Array<{ file: string, lines: number[] }>} changes
 * @returns {Array<{ file: string, overlap: number[] }>}
 */
export function detectSemanticConflicts(changes) {
  const conflicts = [];
  for (let i = 0; i < changes.length; i++) {
    for (let j = i + 1; j < changes.length; j++) {
      if (changes[i].file !== changes[j].file) continue;
      const setA = new Set(changes[i].lines);
      const overlap = changes[j].lines.filter(l => setA.has(l));
      if (overlap.length > 0) {
        conflicts.push({ file: changes[i].file, overlap });
      }
    }
  }
  return conflicts;
}
