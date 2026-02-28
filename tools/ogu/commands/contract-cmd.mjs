import { generateContract, listContracts } from './lib/contract-generator.mjs';

/**
 * ogu contract:generate <name> [--invariant <text>...]
 */
export async function contractGenerate() {
  const args = process.argv.slice(3);
  const invariants = [];
  let name = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--invariant' && args[i + 1]) { invariants.push(args[++i]); continue; }
    if (!name && !args[i].startsWith('--')) name = args[i];
  }

  if (!name) {
    console.error('Usage: ogu contract:generate <name> [--invariant <text>]');
    return 1;
  }

  const result = generateContract({ name, invariants });
  console.log(`Generated contract: ${result.path}`);
  return 0;
}

/**
 * ogu contract:list [--json]
 */
export async function contractList() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');
  const contracts = listContracts();

  if (jsonOutput) {
    console.log(JSON.stringify(contracts, null, 2));
  } else {
    console.log(`Contracts: ${contracts.length}\n`);
    for (const c of contracts) {
      console.log(`  ${c.name} — ${c.path}`);
    }
  }
  return 0;
}
