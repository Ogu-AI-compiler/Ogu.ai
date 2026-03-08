import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * MS003 — folders-declared
 * Every internal folder that exists in the module must be declared in capabilities[].
 * No undeclared internal folders allowed — prevents ad hoc sprawl.
 */

const CAPABILITY_FOLDERS = [
  'services', 'repositories', 'workflows', 'clients',
  'events', 'jobs', 'webhooks', 'cache', 'graphql',
];

function findModuleDir(dir, moduleName) {
  const candidates = [
    join(dir, 'src', 'modules', moduleName),
    join(dir, 'src', moduleName),
    join(dir, moduleName),
    dir,
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'module-spec.json'), 'utf8'));
  const moduleName = spec.name;
  const declaredCaps = new Set(spec.capabilities);

  const moduleDir = findModuleDir(dir, moduleName);
  if (!moduleDir) {
    return {
      pass: true, code: 'MS003',
      message: 'Module directory not yet created — folders-declared gate skipped',
      skipped: true
    };
  }

  let entries;
  try {
    entries = readdirSync(moduleDir, { withFileTypes: true });
  } catch {
    return { pass: true, code: 'MS003', message: 'Module directory empty — skipping', skipped: true };
  }

  const presentFolders = entries
    .filter(e => e.isDirectory() && CAPABILITY_FOLDERS.includes(e.name))
    .map(e => e.name);

  const undeclared = presentFolders.filter(f => !declaredCaps.has(f));

  if (undeclared.length) {
    return {
      pass: false, code: 'MS003',
      message: `Undeclared internal folders found: ${undeclared.join(', ')}`,
      detail: `Add these to capabilities[] in module-spec.json or remove the folders.\nDeclared: ${spec.capabilities.join(', ')}`
    };
  }

  return {
    pass: true, code: 'MS003',
    message: `All internal folders are declared — present: ${presentFolders.join(', ') || 'none'}`
  };
}
