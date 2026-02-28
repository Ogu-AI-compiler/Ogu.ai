import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';

/**
 * Shared Context Store — agents write/read context for handoff.
 *
 * Storage: .ogu/context/{featureSlug}/{key}.json
 *
 * ogu context:write --feature <slug> --key <key> --value <json>
 * ogu context:read  --feature <slug> --key <key> [--json]
 * ogu context:list  --feature <slug> [--json]
 */

function contextDir(feature) {
  return join(repoRoot(), `.ogu/context/${feature}`);
}

export async function contextWrite() {
  const args = process.argv.slice(3);
  let feature = null, key = null, value = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && args[i + 1]) feature = args[++i];
    else if (args[i] === '--key' && args[i + 1]) key = args[++i];
    else if (args[i] === '--value' && args[i + 1]) value = args[++i];
  }

  if (!feature || !key || !value) {
    console.error('Usage: ogu context:write --feature <slug> --key <key> --value <json>');
    return 1;
  }

  const dir = contextDir(feature);
  mkdirSync(dir, { recursive: true });

  // Parse value as JSON if possible, otherwise store as string
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = value;
  }

  const entry = {
    key,
    value: parsed,
    writtenAt: new Date().toISOString(),
    writtenBy: 'cli',
  };

  writeFileSync(join(dir, `${key}.json`), JSON.stringify(entry, null, 2), 'utf8');

  emitAudit('context.write', {
    featureSlug: feature,
    key,
    valueType: typeof parsed,
  });

  console.log(`Context written: ${feature}/${key}`);
  return 0;
}

export async function contextRead() {
  const args = process.argv.slice(3);
  let feature = null, key = null, jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && args[i + 1]) feature = args[++i];
    else if (args[i] === '--key' && args[i + 1]) key = args[++i];
    else if (args[i] === '--json') jsonOutput = true;
  }

  if (!feature || !key) {
    console.error('Usage: ogu context:read --feature <slug> --key <key> [--json]');
    return 1;
  }

  const filePath = join(contextDir(feature), `${key}.json`);
  if (!existsSync(filePath)) {
    console.error(`Context key not found: ${feature}/${key}`);
    return 1;
  }

  const entry = JSON.parse(readFileSync(filePath, 'utf8'));

  if (jsonOutput) {
    console.log(JSON.stringify(entry.value, null, 2));
  } else {
    console.log(`Key: ${key}`);
    console.log(`Written: ${entry.writtenAt}`);
    console.log(`Value: ${JSON.stringify(entry.value, null, 2)}`);
  }

  return 0;
}

export async function contextList() {
  const args = process.argv.slice(3);
  let feature = null, jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && args[i + 1]) feature = args[++i];
    else if (args[i] === '--json') jsonOutput = true;
  }

  if (!feature) {
    console.error('Usage: ogu context:list --feature <slug> [--json]');
    return 1;
  }

  const dir = contextDir(feature);
  if (!existsSync(dir)) {
    if (jsonOutput) console.log('[]');
    else console.log('No context entries.');
    return 0;
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  const keys = files.map(f => f.replace('.json', ''));

  if (jsonOutput) {
    console.log(JSON.stringify(keys, null, 2));
  } else {
    console.log(`Context for "${feature}" (${keys.length} entries):`);
    for (const k of keys) {
      console.log(`  ${k}`);
    }
  }

  return 0;
}

/**
 * Load context value programmatically (for agent:run handoff).
 */
export function loadContext(feature, key) {
  const filePath = join(contextDir(feature), `${key}.json`);
  if (!existsSync(filePath)) return null;
  const entry = JSON.parse(readFileSync(filePath, 'utf8'));
  return entry.value;
}
