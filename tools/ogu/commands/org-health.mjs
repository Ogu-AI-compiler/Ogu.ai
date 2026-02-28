import { computeHealthScore } from './lib/org-health.mjs';

/**
 * ogu org:health [--json]
 */

export async function orgHealth() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');

  const score = computeHealthScore();

  if (jsonOutput) {
    console.log(JSON.stringify(score, null, 2));
    return 0;
  }

  const bar = (val) => {
    const filled = Math.round(val / 5);
    return '█'.repeat(filled) + '░'.repeat(20 - filled);
  };

  const grade = score.overall >= 80 ? 'A' : score.overall >= 60 ? 'B' : score.overall >= 40 ? 'C' : score.overall >= 20 ? 'D' : 'F';

  console.log(`\n  Org Health Score: ${score.overall}/100 (${grade})\n`);
  console.log(`  Agents:     ${bar(score.components.agents)} ${score.components.agents}`);
  console.log(`  Budget:     ${bar(score.components.budget)} ${score.components.budget}`);
  console.log(`  Governance: ${bar(score.components.governance)} ${score.components.governance}`);
  console.log(`  Pipeline:   ${bar(score.components.pipeline)} ${score.components.pipeline}`);
  console.log('');

  return 0;
}
