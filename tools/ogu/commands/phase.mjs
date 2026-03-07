import { join } from 'node:path';
import { repoRoot, readJsonSafe } from '../util.mjs';
import { detectPhase, PHASE_ORDER } from './lib-generic/phase-detector.mjs';
import { ValidTransitions } from '../../contracts/schemas/feature-state.mjs';

export async function phase() {
  const root = repoRoot();
  const state = readJsonSafe(join(root, '.ogu/STATE.json')) || {};
  const involvement = state.involvement_level || null;
  const { current, feature, phaseIndex } = detectPhase({ root });

  console.log(`\n  Lifecycle Phase`);
  console.log(`  Feature: ${feature || '(none)'}`);
  console.log(`  State:   ${current.toUpperCase()}`);
  console.log(`  Involvement: ${involvement || 'NOT SET'}`);
  console.log('');

  for (let i = 0; i < PHASE_ORDER.length; i++) {
    const p = PHASE_ORDER[i];
    let marker;
    if (i < phaseIndex) marker = 'DONE';
    else if (i === phaseIndex) marker = 'CURRENT';
    else marker = 'PENDING';
    console.log(`  ${marker === 'CURRENT' ? '>' : ' '} [${i + 1}] ${p.padEnd(12)} ${marker}`);
  }

  if (feature) {
    const next = ValidTransitions[current] || [];
    if (next.length > 0) {
      console.log(`\n  Next states: ${next.join(', ')}`);
    }
  }

  console.log('');
  return 0;
}
