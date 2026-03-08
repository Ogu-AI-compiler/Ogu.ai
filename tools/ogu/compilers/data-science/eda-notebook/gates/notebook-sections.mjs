import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EN002 — notebook-sections
 * EDA notebooks must contain all required analysis sections.
 *
 * Why:
 * - EDA is not just generating plots — it's a systematic investigation that
 *   answers specific questions before modeling decisions are made.
 * - Missing sections lead to "EDA debt": modeling choices made without
 *   understanding the data, which surfaces later as unexplained model failures.
 * - Required sections map to modeling decisions:
 *   - Data Overview → know what you're working with (shape, dtypes, sample)
 *   - Missing Values → imputation strategy decisions
 *   - Distributions → normalization, outlier handling, feature transforms
 *   - Correlations → multicollinearity risk, feature selection
 *   - Key Findings → documented rationale for downstream modeling decisions
 *
 * Detection: checks notebook cells (both code patterns and markdown headings).
 * Works with .ipynb, .py (percent-format), and standalone .md files.
 *
 * Escape hatch: add "skipSections": ["Correlations"] to eda-spec.json for
 * legitimately absent sections (e.g., NLP/text data has no meaningful correlations).
 */

const REQUIRED_SECTIONS = [
  {
    name: 'Data Overview',
    patterns: [
      /\.info\s*\(\)/,
      /\.describe\s*\(\)/,
      /\.shape\b/,
      /\.dtypes\b/,
      /\.head\s*\(/,
      /(?:data|dataset)\s+overview/i,
      /#\s*(?:\d+\.\s*)?(?:data\s*overview|overview)/i,
    ],
  },
  {
    name: 'Missing Values',
    patterns: [
      /\.isnull\s*\(\)/,
      /\.isna\s*\(\)/,
      /\.notna\s*\(\)/,
      /msno\./,
      /missingno/,
      /missing.{0,10}value/i,
      /#\s*missing/i,
    ],
  },
  {
    name: 'Distributions',
    patterns: [
      /\.hist\s*\(/,
      /\.boxplot\s*\(/,
      /sns\.(?:distplot|histplot|kdeplot|boxplot)/,
      /plt\.hist\s*\(/,
      /value_counts\s*\(\)/,
      /distribution/i,
    ],
  },
  {
    name: 'Correlations',
    patterns: [
      /\.corr\s*\(\)/,
      /sns\.heatmap/,
      /sns\.pairplot/,
      /scatter(?:_matrix|plot)?/,
      /correlation/i,
    ],
  },
  {
    name: 'Key Findings',
    patterns: [
      /key.{0,15}finding/i,
      /conclusion/i,
      /insight/i,
      /(?:#|##)\s*(?:summary|findings?|takeaway|next.steps?)/i,
    ],
  },
];

function extractText(dir) {
  const texts = [];
  const allFiles = readdirSync(dir);

  for (const file of allFiles) {
    if (file.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        for (const cell of nb.cells ?? []) {
          texts.push((cell.source ?? []).join(''));
        }
      } catch { /* skip unreadable notebooks */ }
    } else if (file.endsWith('.py') || file.endsWith('.md')) {
      texts.push(readFileSync(join(dir, file), 'utf8'));
    }
  }
  return texts.join('\n');
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'eda-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'EN002', message: 'eda-spec.json not readable' }; }

  const skipSections = new Set(spec.skipSections ?? []);
  const content = extractText(dir);

  if (!content.trim()) {
    return { pass: false, code: 'EN002', message: 'No notebook or analysis files found' };
  }

  const missing = REQUIRED_SECTIONS
    .filter(s => !skipSections.has(s.name))
    .filter(s => !s.patterns.some(p => p.test(content)));

  if (missing.length) {
    const skippedNote = skipSections.size ? ` (${[...skipSections].join(', ')} skipped via spec)` : '';
    return {
      pass: false, code: 'EN002',
      message: `Missing EDA sections: ${missing.map(s => s.name).join(', ')}${skippedNote}`,
      detail: missing.map(s => `• ${s.name}`).join('\n') +
        '\n\nAdd these as markdown headings + analysis cells.' +
        '\nSkip legitimately absent sections with "skipSections": ["Correlations"] in eda-spec.json.',
    };
  }

  return {
    pass: true, code: 'EN002',
    message: `All ${REQUIRED_SECTIONS.length - skipSections.size} required EDA sections present`,
  };
}
