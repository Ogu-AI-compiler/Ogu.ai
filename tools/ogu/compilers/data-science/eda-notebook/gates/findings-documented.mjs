import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * EN008 — findings-documented
 * EDA notebooks must conclude with explicit, documented key findings.
 *
 * Why:
 * - EDA that doesn't produce written findings is exploratory for the author
 *   but invisible to teammates, future maintainers, and code reviewers.
 * - The most common failure mode: plots are generated, insights are noticed
 *   mentally, but never written down. Then the model is trained on a decision
 *   nobody else understands, and nobody can challenge or improve it.
 * - Documented findings serve as the bridge between EDA and feature engineering:
 *   "high-cardinality in city column → hash encoding" is a decision that
 *   should be traceable to an EDA finding, not implicit in code.
 * - Quality bar: findings must be specific (mention column names, values,
 *   or percentages), not generic ("the data looks interesting").
 *
 * Detection: looks for:
 * - A section heading (## Key Findings / ## Conclusions / ## Summary)
 * - Followed by at least 2 substantive bullet points or sentences
 * - That contain specific references (column names, numbers, percentages)
 */

const SECTION_RE = /(?:^|\n)\s*#{1,3}\s*(?:key\s+)?(?:findings?|conclusions?|summary|insights?|takeaway|next\s+steps?)/i;

// Lines that seem substantive (not just headings or empty)
const SUBSTANTIVE_RE = /[-*•]\s*\S.{15,}|^\d+\.\s+\S.{15,}/;

// Specific references — numbers, %, column mentions in code-style
const SPECIFIC_RE = /\d+\.?\d*\s*%|\d{2,}|\b(column|feature|variable|class|label|target|missing|null|outlier)\b/i;

function extractMarkdownCells(dir) {
  const markdownBlocks = [];
  const files = readdirSync(dir);

  for (const file of files) {
    if (file.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        for (const cell of nb.cells ?? []) {
          if (cell.cell_type === 'markdown') {
            markdownBlocks.push((cell.source ?? []).join(''));
          }
        }
      } catch { /* skip */ }
    } else if (file.endsWith('.md')) {
      markdownBlocks.push(readFileSync(join(dir, file), 'utf8'));
    }
  }
  return markdownBlocks.join('\n');
}

export async function run({ dir }) {
  const markdown = extractMarkdownCells(dir);

  if (!markdown.trim()) {
    // Fall back to py files for percent-format notebooks
    const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
    if (!pyFiles.length) {
      return { pass: false, code: 'EN008', message: 'No notebook or markdown files found' };
    }
    // Less strict check for .py files — just look for findings section
    const pyContent = pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
    if (!SECTION_RE.test(pyContent)) {
      return {
        pass: false, code: 'EN008',
        message: 'No key findings section in EDA script',
        detail: 'Add a comment section:\n# Key Findings\n# - 23% of users missing age field → median imputation\n# - strong correlation between purchase_count and churn (r=0.67)\n# Next Steps:\n# - engineer interaction feature: recency × frequency',
      };
    }
    return { pass: true, code: 'EN008', message: 'Key findings section present' };
  }

  const hasFindingsSection = SECTION_RE.test(markdown);
  if (!hasFindingsSection) {
    return {
      pass: false, code: 'EN008',
      message: 'No key findings section in EDA notebook',
      detail: 'Add a markdown cell:\n## Key Findings\n- 23% of records missing `age` — will use median imputation\n- `purchase_count` strongly correlated with churn (r=0.67)\n- `city` has 847 unique values — hash encoding or grouping needed\n\n## Next Steps\n- Engineer recency × frequency interaction feature\n- Investigate outliers in `revenue` column (>$50k)',
    };
  }

  // Extract the findings section and check for substantive content
  const sectionStart = markdown.search(SECTION_RE);
  const sectionText  = markdown.slice(sectionStart);

  const lines = sectionText.split('\n').slice(1); // skip the heading line
  const bullets = lines.filter(l => SUBSTANTIVE_RE.test(l));

  if (bullets.length < 2) {
    return {
      pass: false, code: 'EN008',
      message: 'Key findings section present but lacks substantive content (< 2 findings)',
      detail: 'The findings section needs at least 2 specific findings:\n' +
        '- Mention column names, percentages, or numeric values\n' +
        '- e.g. "- `revenue` has 34 outliers (>3 std) → winsorize at 99th percentile"',
    };
  }

  const hasSpecifics = bullets.some(l => SPECIFIC_RE.test(l));
  if (!hasSpecifics) {
    return {
      pass: false, code: 'EN008',
      message: 'Key findings are generic — add specific column names, numbers, or percentages',
      detail: 'Bad:  "- The data has some missing values"\nGood: "- `income` column: 18% missing values — impute with median ($52,400)"',
    };
  }

  return {
    pass: true, code: 'EN008',
    message: `Key findings documented with ${bullets.length} specific finding(s)`,
  };
}
