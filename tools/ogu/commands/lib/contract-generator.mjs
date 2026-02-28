import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Contract Generator — automated .contract.md documentation.
 *
 * Generates formal contract files from structured input.
 * Contracts define invariants, interfaces, and data files for each subsystem.
 */

/**
 * Generate a .contract.md file.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} opts.name - Contract name (e.g., "Budget", "OrgSpec")
 * @param {string[]} opts.invariants - List of invariant statements
 * @param {Array<{ name, type, description }>} opts.interfaces - CLI/API interfaces
 * @param {string[]} opts.dataFiles - Data file paths
 * @param {string} [opts.version] - Contract version
 * @returns {{ path, name }}
 */
export function generateContract({ root, name, invariants, interfaces, dataFiles, version } = {}) {
  root = root || repoRoot();
  const contractDir = join(root, 'docs/vault/02_Contracts');
  mkdirSync(contractDir, { recursive: true });

  const fileName = `${name}.contract.md`;
  const filePath = join(contractDir, fileName);

  const lines = [];
  lines.push(`# Contract: ${name}`);
  lines.push('');
  lines.push(`> Version: ${version || '1.0.0'}`);
  lines.push(`> Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // Invariants
  lines.push('## Invariants');
  lines.push('');
  for (const inv of (invariants || [])) {
    lines.push(`- ${inv}`);
  }
  lines.push('');

  // Interfaces
  lines.push('## Interfaces');
  lines.push('');
  if (interfaces && interfaces.length > 0) {
    lines.push('| Name | Type | Description |');
    lines.push('|------|------|-------------|');
    for (const iface of interfaces) {
      lines.push(`| \`${iface.name}\` | ${iface.type} | ${iface.description} |`);
    }
  }
  lines.push('');

  // Data Files
  lines.push('## Data Files');
  lines.push('');
  for (const df of (dataFiles || [])) {
    lines.push(`- \`${df}\``);
  }
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*This contract is law until changed by ADR.*');
  lines.push('');

  writeFileSync(filePath, lines.join('\n'));
  return { path: filePath, name };
}

/**
 * List all generated contracts.
 */
export function listContracts({ root } = {}) {
  root = root || repoRoot();
  const contractDir = join(root, 'docs/vault/02_Contracts');
  if (!existsSync(contractDir)) return [];

  return readdirSync(contractDir)
    .filter(f => f.endsWith('.contract.md'))
    .map(f => ({
      name: f.replace('.contract.md', ''),
      path: join(contractDir, f),
    }));
}
