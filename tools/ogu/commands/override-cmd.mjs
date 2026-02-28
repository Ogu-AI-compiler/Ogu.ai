import { createOverride, listOverrides, revokeOverride } from './lib/override-handler.mjs';

/**
 * ogu override:create --target <target> --reason <reason> --authority <roleId> --feature <slug>
 */
export async function overrideCreate() {
  const args = process.argv.slice(3);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const target = getArg('--target');
  const reason = getArg('--reason');
  const authority = getArg('--authority');
  const featureSlug = getArg('--feature');

  if (!target || !reason || !authority) {
    console.error('Usage: ogu override:create --target <target> --reason <reason> --authority <roleId> --feature <slug>');
    return 1;
  }

  try {
    const rec = createOverride({ target, reason, authority, featureSlug });
    console.log(`Override created: ${rec.id}`);
    console.log(`  Target: ${rec.target}`);
    console.log(`  Authority: ${rec.authority}`);
    console.log(`  Expires: ${rec.expiresAt}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    return 1;
  }

  return 0;
}

/**
 * ogu override:list [--active] [--json]
 */
export async function overrideList() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');
  const activeOnly = args.includes('--active');

  const overrides = listOverrides({ status: activeOnly ? 'active' : undefined });

  if (jsonOutput) {
    console.log(JSON.stringify(overrides, null, 2));
    return 0;
  }

  if (overrides.length === 0) {
    console.log('No overrides found.');
    return 0;
  }

  console.log(`\n  Overrides (${overrides.length}):\n`);
  for (const o of overrides) {
    const status = o.status === 'active' ? '●' : o.status === 'revoked' ? '○' : '⊘';
    const authStr = typeof o.authority === 'object' ? o.authority.role : String(o.authority);
    console.log(`  ${status} ${o.target.padEnd(20)} ${authStr.padEnd(12)} ${o.status.padEnd(8)} ${o.reason}`);
  }
  console.log('');
  return 0;
}

/**
 * ogu override:revoke <id>
 */
export async function overrideRevoke() {
  const id = process.argv[3];
  if (!id) {
    console.error('Usage: ogu override:revoke <override-id>');
    return 1;
  }

  try {
    const rec = revokeOverride({ overrideId: id });
    console.log(`Override revoked: ${rec.id}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    return 1;
  }

  return 0;
}
