/**
 * Gate UXS003 — offline-state
 * Screens that depend on network calls (networkDependent: true, or any dependency
 * with source: "api" or source: "remote") must declare an "offline" state.
 * Escape hatch: screen.offlineHandledGlobally = true (handled by app-level offline banner).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function isNetworkDependent(screen) {
  if (screen.networkDependent === true) return true;
  if (!Array.isArray(screen.dataDependencies)) return false;
  return screen.dataDependencies.some(dep => {
    if (typeof dep === 'string') return false;
    return dep.source === 'api' || dep.source === 'remote' || dep.networkRequired === true;
  });
}

function hasOfflineState(screen) {
  if (!Array.isArray(screen.states)) return false;
  return screen.states.some(s => {
    const type = typeof s === 'string' ? s : s.type;
    return type === 'offline';
  });
}

export async function run({ dir }) {
  const specPath = join(dir, 'state-matrix-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXS003', message: 'state-matrix-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXS003', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.screens) || spec.screens.length === 0) {
    return { pass: true, code: 'UXS003', message: 'No screens to check — skipped', skipped: true };
  }

  const violations = [];

  for (const screen of spec.screens) {
    if (!isNetworkDependent(screen)) continue;
    if (screen.offlineHandledGlobally === true) continue;
    if (!hasOfflineState(screen)) {
      violations.push(
        `Screen "${screen.id}" is network-dependent but has no "offline" state declared ` +
        `(or set offlineHandledGlobally: true if handled by app-level banner)`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXS003',
      message: `${violations.length} network-dependent screen(s) missing offline state`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXS003',
    message: 'offline-state: all network-dependent screens declare offline handling',
  };
}
