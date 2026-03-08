import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA026 — selectors-are-accessible
 * Page object files must not use CSS class selectors (.class) or ID selectors (#id).
 * They must use accessible role-based selectors:
 *   getByRole, getByLabel, getByText, getByTestId, getByPlaceholder, getByTitle
 *
 * Why:
 * - CSS class selectors break when CSS is refactored (which is frequent)
 * - ID selectors break when component hierarchy changes
 * - Role-based selectors are resilient AND test accessibility at the same time
 *   (if getByRole fails, the element is inaccessible to screen readers too)
 *
 * Scans: **/pages/*.ts, **/pageObjects/*.ts, **/e2e/**/*.ts (excluding test files)
 *
 * Escape hatch: // @css-selector-ok: reason (for truly unavoidable CSS selectors)
 */

// Matches: page.locator('.class'), page.locator('#id'), $('..'), cy.get('.class')
const CSS_SELECTOR_RE = /\.(?:locator|find|\$|get)\s*\(\s*['"`]([.#][^'"`]+)['"`]/;

function collectPageObjectFiles(dir) {
  const files = [];
  const PAGE_DIRS = ['pages', 'pageObjects', 'page-objects', 'fixtures', 'e2e', 'playwright', 'cypress'];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (
        f.name.match(/\.(ts|mjs|js)$/) &&
        !f.name.match(/\.(test|spec)\.(ts|mjs|js)$/) &&
        (PAGE_DIRS.some(pd => d.includes(pd)) || f.name.toLowerCase().includes('page'))
      ) {
        files.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir, projectRoot }) {
  const root = projectRoot || dir;
  const files = collectPageObjectFiles(root);

  if (files.length === 0) {
    return {
      pass: true, code: 'QA026',
      message: 'No page object files found — skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//')) continue;

      // Check escape hatch
      if (/@css-selector-ok/.test(line) || (i > 0 && /@css-selector-ok/.test(lines[i - 1]))) continue;

      const m = CSS_SELECTOR_RE.exec(line);
      if (m) {
        const selector = m[1];
        violations.push(
          `${file.replace(root + '/', '')}:${i + 1} — CSS selector "${selector}" — use getByRole/getByLabel instead`
        );
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA026',
      message: `${violations.length} CSS/ID selector(s) in page objects`,
      detail: violations.slice(0, 10).join('\n') + '\n\nReplace with Playwright accessible selectors:\n  page.getByRole("button", { name: "Submit" })\n  page.getByLabel("Email address")',
    };
  }

  return {
    pass: true, code: 'QA026',
    message: `All page objects use accessible selectors (${files.length} file(s) checked)`,
  };
}
