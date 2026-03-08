/**
 * Gate: provider-allowed (IAC006)
 * For Terraform: verifies that all declared providers are on the allowed list for the
 * target cloud. Unapproved providers introduce unreviewed cloud integrations and can
 * bypass cost controls, security policies, and compliance boundaries.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/** Per-cloud allow-list of Terraform provider names */
const ALLOWED_PROVIDERS = {
  aws:          ['aws', 'hashicorp/aws', 'archive', 'null', 'random', 'local', 'tls'],
  gcp:          ['google', 'hashicorp/google', 'google-beta', 'archive', 'null', 'random'],
  azure:        ['azurerm', 'hashicorp/azurerm', 'azuread', 'archive', 'null', 'random'],
  digitalocean: ['digitalocean', 'archive', 'null', 'random'],
  cloudflare:   ['cloudflare', 'archive', 'null', 'random'],
  multi:        ['aws', 'google', 'azurerm', 'archive', 'null', 'random', 'tls', 'local'],
};

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'iac-spec.json'), 'utf8'));

  if (spec.platform !== 'terraform') {
    return { pass: true, code: 'IAC006', message: `Non-Terraform platform — provider check skipped`, skipped: true };
  }

  const allowed = ALLOWED_PROVIDERS[spec.cloud];
  if (!allowed) {
    return { pass: true, code: 'IAC006', message: `Unknown cloud "${spec.cloud}" — provider check skipped`, skipped: true };
  }

  let tfFiles;
  try {
    tfFiles = readdirSync(dir).filter(f => f.endsWith('.tf')).map(f => join(dir, f));
  } catch {
    return { pass: true, code: 'IAC006', message: 'No .tf files — skipped', skipped: true };
  }

  if (tfFiles.length === 0) {
    return { pass: true, code: 'IAC006', message: 'No .tf files — skipped', skipped: true };
  }

  const allContent = tfFiles.map(f => readFileSync(f, 'utf8')).join('\n');
  const violations = [];

  const providerBlockMatches = [...allContent.matchAll(/required_providers\s*\{([^}]+)\}/gs)];
  for (const m of providerBlockMatches) {
    for (const pn of m[1].matchAll(/(\w+)\s*=/g)) {
      const name = pn[1];
      if (!allowed.includes(name)) {
        violations.push({
          provider: name,
          reason:   `provider "${name}" is not on the approved list for cloud "${spec.cloud}"`,
        });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'IAC006',
      message: `${violations.length} disallowed provider(s)`,
      detail: {
        violations,
        allowedForCloud: { cloud: spec.cloud, providers: allowed },
        hint: 'Raise an IaC review request to add the provider to the allow-list, or use an approved alternative',
      },
    };
  }

  return { pass: true, code: 'IAC006', message: `All providers allowed for cloud: ${spec.cloud}` };
}
