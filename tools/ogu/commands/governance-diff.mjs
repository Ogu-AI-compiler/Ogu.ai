import { execSync } from 'node:child_process';
import { repoRoot } from '../util.mjs';
import { checkDiff } from './lib/diff-checker.mjs';

/**
 * ogu governance:diff-check [--json]
 *
 * Analyze staged git changes for dangerous patterns.
 */

export async function governanceDiffCheck() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');

  const root = repoRoot();

  // Get staged diff from git (or recent changes)
  let diffFiles = [];
  try {
    const diff = execSync('git diff --cached --name-only', { cwd: root, encoding: 'utf8', timeout: 5000 });
    const files = diff.trim().split('\n').filter(Boolean);

    for (const file of files) {
      try {
        const additions = execSync(`git diff --cached -- "${file}" | grep "^+" | grep -v "^+++"`, {
          cwd: root, encoding: 'utf8', timeout: 5000,
        }).trim().split('\n').filter(Boolean).map(l => l.slice(1));

        const deletions = execSync(`git diff --cached -- "${file}" | grep "^-" | grep -v "^---"`, {
          cwd: root, encoding: 'utf8', timeout: 5000,
        }).trim().split('\n').filter(Boolean).map(l => l.slice(1));

        diffFiles.push({ path: file, additions, deletions });
      } catch {
        diffFiles.push({ path: file, additions: [], deletions: [] });
      }
    }
  } catch {
    // No staged changes — check unstaged
    diffFiles = [];
  }

  const result = checkDiff({ files: diffFiles });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  if (result.approved) {
    console.log(`✓ Diff check passed (${result.fileCount} files)`);
  } else {
    console.log(`⚠ Diff check warnings (${result.warnings.length}):\n`);
    for (const w of result.warnings) {
      console.log(`  ${w.pattern}: ${w.file}`);
      console.log(`    ${w.detail}`);
    }
  }

  return 0;
}
