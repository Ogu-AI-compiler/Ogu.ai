/**
 * Functional Hash — AST-based hashing for semantic drift detection.
 *
 * Computes hashes based on code structure rather than raw text.
 * Ignores whitespace, comments, and (optionally) variable names
 * to detect whether two pieces of code are functionally equivalent.
 *
 * Equivalence levels:
 *   L0: Identical (byte-for-byte)
 *   L1: Formatting only (whitespace/comments differ)
 *   L2: Renaming only (variables renamed but logic identical)
 *   L3: Structurally equivalent (same AST shape, different leaf values)
 *   L4: Different (structural changes)
 *
 * Uses regex-based normalization rather than a real parser,
 * matching the project's approach in ast-merge.mjs.
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
  '.py': 'python',
  '.md': 'markdown',
};

function detectLanguage(filenameOrLang) {
  if (!filenameOrLang) return 'unknown';
  if (Object.values(LANGUAGE_MAP).includes(filenameOrLang)) return filenameOrLang;
  for (const [ext, lang] of Object.entries(LANGUAGE_MAP)) {
    if (filenameOrLang.endsWith(ext)) return lang;
  }
  return 'unknown';
}

// ── Block Hashing ────────────────────────────────────────────────────

/**
 * Hash a single code block.
 *
 * @param {string} content - Block content
 * @returns {string} SHA-256 hex hash
 */
export function hashBlock(content) {
  return createHash('sha256').update(content).digest('hex');
}

// ── Comment Stripping ────────────────────────────────────────────────

function stripJSComments(content) {
  // Remove single-line comments (but not URLs like http://)
  let result = content.replace(/(?<![:\/"'])\/\/.*$/gm, '');
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

function stripPythonComments(content) {
  // Remove single-line comments
  let result = content.replace(/#.*$/gm, '');
  // Remove docstrings (triple quotes)
  result = result.replace(/"""[\s\S]*?"""/g, '""');
  result = result.replace(/'''[\s\S]*?'''/g, "''");
  return result;
}

function stripCSSComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripComments(content, language) {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return stripJSComments(content);
    case 'python':
      return stripPythonComments(content);
    case 'css':
      return stripCSSComments(content);
    default:
      return content;
  }
}

// ── Whitespace Normalization ─────────────────────────────────────────

function normalizeWhitespace(content) {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

// ── Identifier Normalization ─────────────────────────────────────────

function normalizeIdentifiers(content, language) {
  if (language === 'json' || language === 'css' || language === 'markdown') {
    return content;
  }

  // Track and replace local variable names with positional identifiers.
  // This detects variable declarations and replaces consistently.
  const identifierMap = new Map();
  let counter = 0;

  // Find variable declarations and build map
  // Match: const/let/var/function param declarations
  const declPatterns = [
    /(?:const|let|var)\s+(\w+)/g,
    /function\s+\w+\s*\(([^)]*)\)/g,
    /(?:def|class)\s+(\w+)/g,
  ];

  for (const pattern of declPatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(content)) !== null) {
      const names = match[1].split(',').map(n => n.trim().split(/\s+/)[0]).filter(Boolean);
      for (const name of names) {
        if (!identifierMap.has(name) && name.length > 1 && !/^(const|let|var|function|class|if|else|for|while|return|import|export|from|async|await|true|false|null|undefined|new|this|throw|try|catch|finally|switch|case|break|continue|default|do|typeof|instanceof|void|delete|in|of|with|yield|def|self|None|True|False|print|pass|raise|except)$/.test(name)) {
          identifierMap.set(name, `_v${counter++}`);
        }
      }
    }
  }

  // Replace all occurrences of mapped identifiers
  let normalized = content;
  // Sort by length descending to avoid partial replacements
  const sorted = [...identifierMap.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [original, replacement] of sorted) {
    // Word-boundary replacement
    const regex = new RegExp(`\\b${escapeRegex(original)}\\b`, 'g');
    normalized = normalized.replace(regex, replacement);
  }

  return normalized;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Structural Normalization ─────────────────────────────────────────

function normalizeStructure(content, language) {
  // Normalize string literals to placeholders
  let result = content;

  if (language === 'javascript' || language === 'typescript') {
    // Replace template literals
    result = result.replace(/`[^`]*`/g, '`__STR__`');
    // Replace double-quoted strings
    result = result.replace(/"(?:[^"\\]|\\.)*"/g, '"__STR__"');
    // Replace single-quoted strings
    result = result.replace(/'(?:[^'\\]|\\.)*'/g, "'__STR__'");
    // Normalize numbers
    result = result.replace(/\b\d+\.?\d*\b/g, '__NUM__');
  }

  if (language === 'python') {
    result = result.replace(/"(?:[^"\\]|\\.)*"/g, '"__STR__"');
    result = result.replace(/'(?:[^'\\]|\\.)*'/g, "'__STR__'");
    result = result.replace(/\b\d+\.?\d*\b/g, '__NUM__');
  }

  return result;
}

// ── Core Functions ───────────────────────────────────────────────────

/**
 * Normalize content for hashing at various levels.
 *
 * @param {string} content - File content
 * @param {string} language - Language name or file extension
 * @returns {{ l0: string, l1: string, l2: string, l3: string }}
 */
export function normalizeForHashing(content, language) {
  const lang = detectLanguage(language);

  // L0: Raw content (no normalization)
  const l0 = content;

  // L1: Strip comments, normalize whitespace
  const noComments = stripComments(content, lang);
  const l1 = normalizeWhitespace(noComments);

  // L2: Also normalize identifiers
  const l2 = normalizeWhitespace(normalizeIdentifiers(noComments, lang));

  // L3: Also normalize string literals and numbers
  const l3 = normalizeWhitespace(normalizeStructure(normalizeIdentifiers(noComments, lang), lang));

  return { l0, l1, l2, l3 };
}

/**
 * Compute a functional hash based on code structure.
 *
 * Returns hashes at multiple normalization levels, allowing
 * callers to choose the desired equivalence sensitivity.
 *
 * @param {string} content - File content
 * @param {string} language - Language name or file extension
 * @returns {{ hash: string, level: string, blocks: object[], hashes: { l0: string, l1: string, l2: string, l3: string } }}
 */
export function computeFunctionalHash(content, language) {
  const lang = detectLanguage(language);
  const normalized = normalizeForHashing(content, lang);

  const hashes = {
    l0: hashBlock(normalized.l0),
    l1: hashBlock(normalized.l1),
    l2: hashBlock(normalized.l2),
    l3: hashBlock(normalized.l3),
  };

  // Determine the "canonical" hash — use L1 (comments/whitespace stripped)
  // as the default functional hash
  const hash = hashes.l1;

  // Extract blocks for per-block hashing
  const blocks = extractFunctionalBlocks(content, lang);

  return { hash, level: 'L1', blocks, hashes };
}

function extractFunctionalBlocks(content, language) {
  const lines = content.split('\n');
  const blocks = [];

  if (language === 'javascript' || language === 'typescript') {
    let i = 0;
    while (i < lines.length) {
      const trimmed = lines[i].trimStart();

      // Function or class block
      if (/^(export\s+)?(async\s+)?function\s|^(export\s+)?class\s/.test(trimmed)) {
        const match = trimmed.match(/(?:export\s+)?(?:async\s+)?(?:function|class)\s+(\w+)/);
        const name = match ? match[1] : 'anonymous';
        const start = i;
        let depth = 0;
        let blockContent = '';
        let foundOpen = false;

        while (i < lines.length) {
          blockContent += (i === start ? '' : '\n') + lines[i];
          for (const ch of lines[i]) {
            if (ch === '{') { depth++; foundOpen = true; }
            if (ch === '}') depth--;
          }
          if (foundOpen && depth <= 0) break;
          i++;
        }

        const stripped = normalizeWhitespace(stripComments(blockContent, language));
        blocks.push({ name, type: 'block', hash: hashBlock(stripped), lines: i - start + 1 });
        i++;
        continue;
      }

      i++;
    }
  }

  if (language === 'python') {
    let i = 0;
    while (i < lines.length) {
      const trimmed = lines[i].trimStart();
      if (/^(def|class|async\s+def)\s/.test(trimmed)) {
        const match = trimmed.match(/^(?:async\s+)?(?:def|class)\s+(\w+)/);
        const name = match ? match[1] : 'anonymous';
        const start = i;
        const indent = lines[i].length - trimmed.length;
        let blockContent = lines[i];
        i++;
        while (i < lines.length) {
          const nextTrimmed = lines[i].trimStart();
          const nextIndent = lines[i].length - nextTrimmed.length;
          if (nextTrimmed === '' || nextIndent > indent) {
            blockContent += '\n' + lines[i];
            i++;
          } else {
            break;
          }
        }
        const stripped = normalizeWhitespace(stripPythonComments(blockContent));
        blocks.push({ name, type: 'block', hash: hashBlock(stripped), lines: i - start });
        continue;
      }
      i++;
    }
  }

  return blocks;
}

// ── Drift Detection ──────────────────────────────────────────────────

/**
 * Compare two functional hashes and detect drift.
 *
 * @param {{ hashes: object, blocks?: object[] }} hash1 - First functional hash result
 * @param {{ hashes: object, blocks?: object[] }} hash2 - Second functional hash result
 * @returns {{ drifted: boolean, changes: object[], severity: string }}
 */
export function detectDrift(hash1, hash2) {
  if (!hash1 || !hash2) {
    return { drifted: true, changes: [{ level: 'missing', detail: 'One or both hashes missing' }], severity: 'critical' };
  }

  const h1 = hash1.hashes || hash1;
  const h2 = hash2.hashes || hash2;

  const changes = [];

  // Check each level
  if (h1.l0 !== h2.l0) changes.push({ level: 'L0', detail: 'Byte-level difference' });
  if (h1.l1 !== h2.l1) changes.push({ level: 'L1', detail: 'Logic difference (ignoring comments/whitespace)' });
  if (h1.l2 !== h2.l2) changes.push({ level: 'L2', detail: 'Logic difference (ignoring renames)' });
  if (h1.l3 !== h2.l3) changes.push({ level: 'L3', detail: 'Structural difference (ignoring literals)' });

  // Compare block-level changes
  const blocks1 = hash1.blocks || [];
  const blocks2 = hash2.blocks || [];
  const blockMap1 = new Map(blocks1.map(b => [b.name, b.hash]));
  const blockMap2 = new Map(blocks2.map(b => [b.name, b.hash]));

  for (const [name, bHash] of blockMap1) {
    if (!blockMap2.has(name)) {
      changes.push({ level: 'block', detail: `Block removed: ${name}` });
    } else if (blockMap2.get(name) !== bHash) {
      changes.push({ level: 'block', detail: `Block modified: ${name}` });
    }
  }
  for (const [name] of blockMap2) {
    if (!blockMap1.has(name)) {
      changes.push({ level: 'block', detail: `Block added: ${name}` });
    }
  }

  // Determine severity
  let severity = 'none';
  if (changes.length > 0) {
    if (changes.some(c => c.level === 'L3')) severity = 'critical';
    else if (changes.some(c => c.level === 'L2')) severity = 'major';
    else if (changes.some(c => c.level === 'L1')) severity = 'minor';
    else if (changes.some(c => c.level === 'block')) severity = 'major';
    else severity = 'trivial';
  }

  return {
    drifted: changes.some(c => c.level !== 'L0' || c.level === 'L0'),
    changes,
    severity,
  };
}

// ── Equivalence Level ────────────────────────────────────────────────

/**
 * Determine the equivalence level between two pieces of content.
 *
 * @param {string} content1 - First content
 * @param {string} content2 - Second content
 * @returns {{ level: number, label: string, description: string }}
 */
export function equivalenceLevel(content1, content2) {
  if (content1 === content2) {
    return { level: 0, label: 'L0', description: 'Identical (byte-for-byte)' };
  }

  // Detect language from content heuristics
  const lang = guessLanguage(content1);
  const n1 = normalizeForHashing(content1, lang);
  const n2 = normalizeForHashing(content2, lang);

  // L1: Only whitespace/comment differences
  if (hashBlock(n1.l1) === hashBlock(n2.l1)) {
    return { level: 1, label: 'L1', description: 'Formatting only (whitespace/comments differ)' };
  }

  // L2: Only variable renaming
  if (hashBlock(n1.l2) === hashBlock(n2.l2)) {
    return { level: 2, label: 'L2', description: 'Renaming only (variables renamed but logic identical)' };
  }

  // L3: Structurally equivalent
  if (hashBlock(n1.l3) === hashBlock(n2.l3)) {
    return { level: 3, label: 'L3', description: 'Structurally equivalent (same AST structure, different values)' };
  }

  // L4: Different
  return { level: 4, label: 'L4', description: 'Different (structural changes)' };
}

function guessLanguage(content) {
  if (/^import\s.*from\s/.test(content) || /^export\s/.test(content) || /^const\s/.test(content)) {
    return 'javascript';
  }
  if (/^def\s|^class\s|^import\s\w/.test(content)) {
    return 'python';
  }
  if (/^\{/.test(content.trim())) {
    return 'json';
  }
  return 'unknown';
}
