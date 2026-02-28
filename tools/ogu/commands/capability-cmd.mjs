import { resolveChain, listCapabilities, getEscalationChain } from './lib/capability-registry.mjs';

/**
 * ogu capability:resolve --capability <cap> [--risk-tier <tier>] [--json]
 */
export async function capabilityResolve() {
  const args = process.argv.slice(3);
  const capIdx = args.indexOf('--capability');
  const capability = capIdx >= 0 ? args[capIdx + 1] : args[0];
  const riskIdx = args.indexOf('--risk-tier');
  const riskTier = riskIdx >= 0 ? args[riskIdx + 1] : undefined;
  const jsonOutput = args.includes('--json');

  if (!capability) {
    console.error('Usage: ogu capability:resolve --capability <cap>');
    return 1;
  }

  const chain = resolveChain({ capability, riskTier });

  if (!chain) {
    console.error(`No role found for capability: ${capability}`);
    return 1;
  }

  if (jsonOutput) {
    console.log(JSON.stringify(chain, null, 2));
    return 0;
  }

  console.log(`\n  Capability: ${chain.capability}`);
  console.log(`  Role:       ${chain.roleName} (${chain.roleId})`);
  console.log(`  Model:      ${chain.model}`);
  console.log(`  Risk Tier:  ${chain.riskTier}`);
  if (chain.escalation.length > 0) {
    console.log(`  Escalation: ${chain.escalation.join(' → ')}`);
  }
  console.log('');

  return 0;
}

/**
 * ogu capability:list [--json]
 */
export async function capabilityList() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');

  const caps = listCapabilities();

  if (jsonOutput) {
    console.log(JSON.stringify(caps));
    return 0;
  }

  console.log(`\n  Capabilities (${caps.length}):\n`);
  for (const cap of caps) {
    const capId = typeof cap === 'string' ? cap : cap.id;
    const capName = typeof cap === 'string' ? cap : (cap.name || cap.id);
    const chain = resolveChain({ capability: capId });
    const role = chain ? `→ ${chain.roleName}` : '';
    console.log(`  ${capId.padEnd(22)} ${capName.padEnd(24)} ${role}`);
  }
  console.log('');

  return 0;
}
