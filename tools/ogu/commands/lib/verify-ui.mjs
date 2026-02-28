import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * verify-ui — Real UI verification.
 *
 * Scans source files for:
 *   - Links (href values)
 *   - Buttons (onClick handlers)
 *   - Forms (onSubmit handlers)
 *   - Problems: href="#", empty onClick, missing handlers
 */

const UI_EXTENSIONS = ['.tsx', '.jsx', '.vue', '.svelte'];

/**
 * Recursively find UI files.
 */
function findUIFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findUIFiles(fullPath, files);
      } else if (UI_EXTENSIONS.includes(extname(entry))) {
        files.push(fullPath);
      }
    } catch { /* skip */ }
  }
  return files;
}

/**
 * Analyze a single UI file for interactive elements.
 */
function analyzeFile(filePath, root) {
  const content = readFileSync(filePath, 'utf8');
  const relativePath = filePath.replace(root + '/', '');

  const links = [];
  const buttons = [];
  const forms = [];
  const problems = [];

  // Detect links: href="..."
  const hrefRe = /href=["']([^"']*)["']/g;
  let m;
  while ((m = hrefRe.exec(content)) !== null) {
    const href = m[1];
    links.push({ href, line: content.slice(0, m.index).split('\n').length });
    if (href === '#') {
      problems.push({
        type: 'bad-link',
        file: relativePath,
        detail: `href="#" found (line ~${content.slice(0, m.index).split('\n').length})`,
      });
    }
  }

  // Detect buttons
  const buttonRe = /<button[^>]*>/gi;
  while ((m = buttonRe.exec(content)) !== null) {
    const tag = m[0];
    const line = content.slice(0, m.index).split('\n').length;
    const hasOnClick = /onClick/.test(tag);
    const hasType = /type=["']submit["']/.test(tag);
    buttons.push({ line, hasOnClick, hasType });

    if (!hasOnClick && !hasType) {
      problems.push({
        type: 'no-handler',
        file: relativePath,
        detail: `Button without onClick or type="submit" (line ~${line})`,
      });
    }

    // Check for empty arrow function: onClick={() => {}}
    if (/onClick=\{?\(\)\s*=>\s*\{\s*\}\}?/.test(tag)) {
      problems.push({
        type: 'empty-handler',
        file: relativePath,
        detail: `Button with empty onClick handler (line ~${line})`,
      });
    }
  }

  // Detect forms
  const formRe = /<form[^>]*>/gi;
  while ((m = formRe.exec(content)) !== null) {
    const tag = m[0];
    const line = content.slice(0, m.index).split('\n').length;
    const hasSubmit = /onSubmit/.test(tag);
    forms.push({ line, hasSubmit });
  }

  return { file: relativePath, links, buttons, forms, problems };
}

/**
 * Scan all UI files and return analysis.
 */
export function scanUIFiles({ root } = {}) {
  root = root || repoRoot();
  const srcDir = join(root, 'src');
  const uiFiles = findUIFiles(srcDir);

  const results = uiFiles.map(f => analyzeFile(f, root));
  const allProblems = results.flatMap(r => r.problems);

  return {
    files: results,
    problems: allProblems,
    totalFiles: results.length,
    totalLinks: results.reduce((s, r) => s + r.links.length, 0),
    totalButtons: results.reduce((s, r) => s + r.buttons.length, 0),
    totalForms: results.reduce((s, r) => s + r.forms.length, 0),
  };
}

/**
 * Run full UI verification and return pass/fail summary.
 */
export function verifyUI({ root } = {}) {
  const scan = scanUIFiles({ root });
  return {
    passed: scan.problems.length === 0,
    totalFiles: scan.totalFiles,
    totalProblems: scan.problems.length,
    totalLinks: scan.totalLinks,
    totalButtons: scan.totalButtons,
    totalForms: scan.totalForms,
    problems: scan.problems,
  };
}
