import { captureCompanySnapshot } from './lib/company-snapshot.mjs';

/**
 * ogu company:snapshot [--label <label>] [--json]
 */
export async function companySnapshot() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');
  const labelIdx = args.indexOf('--label');
  const label = labelIdx >= 0 ? args[labelIdx + 1] : undefined;

  const snap = captureCompanySnapshot({ label });

  if (jsonOutput) {
    console.log(JSON.stringify(snap, null, 2));
    return 0;
  }

  console.log(`Company snapshot captured: ${snap.id}`);
  console.log(`  Label:      ${snap.label || '(none)'}`);
  console.log(`  Org:        ${snap.orgSpec?.org?.name || 'unknown'}`);
  console.log(`  Roles:      ${(snap.orgSpec?.roles || []).length}`);
  console.log(`  Features:   ${snap.features.length}`);
  console.log(`  Audit:      ${snap.auditCount} events`);
  console.log(`  Overrides:  ${snap.overrideCount}`);
  console.log(`  Hash:       ${snap.hash.slice(0, 16)}`);

  return 0;
}
