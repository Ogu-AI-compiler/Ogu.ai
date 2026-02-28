import { verifyUI } from './lib/verify-ui.mjs';

/**
 * ogu verify-ui [--json]
 */
export async function verifyUiCmd() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');

  const result = verifyUI();

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return result.passed ? 0 : 1;
  }

  console.log(`\n  UI Verification\n`);
  console.log(`  Files scanned: ${result.totalFiles}`);
  console.log(`  Links:         ${result.totalLinks}`);
  console.log(`  Buttons:       ${result.totalButtons}`);
  console.log(`  Forms:         ${result.totalForms}`);
  console.log(`  Problems:      ${result.totalProblems}`);

  if (result.problems.length > 0) {
    console.log(`\n  Issues:\n`);
    for (const p of result.problems) {
      console.log(`  ⚠ [${p.type}] ${p.file}: ${p.detail}`);
    }
  }

  console.log(`\n  Result: ${result.passed ? '✓ PASS' : '✗ FAIL'}\n`);

  return result.passed ? 0 : 1;
}
