import { resolveIsolation, describeLevel, ISOLATION_LEVELS } from './lib/isolation-manager.mjs';

/**
 * ogu isolation:resolve --risk <tier> [--touches <paths>]
 * ogu isolation:levels
 */

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { risk: null, touches: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--risk' && args[i + 1]) result.risk = args[++i];
    else if (args[i] === '--touches' && args[i + 1]) result.touches = args[++i].split(',');
  }
  return result;
}

export async function isolationResolve() {
  const args = parseArgs();
  if (!args.risk) {
    console.error('Usage: ogu isolation:resolve --risk <tier> [--touches <paths>]');
    return 1;
  }

  const result = resolveIsolation({ riskTier: args.risk, touches: args.touches });
  const desc = describeLevel(result.level);

  console.log(`Isolation: ${result.level} (${desc.name})`);
  console.log(`  ${desc.description}`);
  console.log(`  Merge: ${desc.mergeStrategy}`);
  console.log(`  Reason: ${result.reason}`);
  return 0;
}

export async function isolationLevels() {
  console.log('\n  Isolation Levels:\n');
  for (const [key, level] of Object.entries(ISOLATION_LEVELS)) {
    console.log(`  ${key} — ${level.name}`);
    console.log(`    ${level.description}`);
    console.log(`    Merge: ${level.mergeStrategy}`);
    console.log('');
  }
  return 0;
}
