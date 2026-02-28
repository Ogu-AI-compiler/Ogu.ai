import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { loadAllEvents, replayChain } from './lib/audit-emitter.mjs';

/**
 * ogu audit:show [--limit N]        — Show recent audit events
 * ogu audit:search --type <type>    — Search/filter audit events
 * ogu audit:export [--type <type>]  — Export audit trail as JSON array
 * ogu audit:replay --event <id>     — Replay chain from event
 */

function loadEvents() {
  return loadAllEvents();
}

function parseArgs() {
  const args = process.argv.slice(3);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      parsed.limit = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--type' && args[i + 1]) {
      parsed.type = args[i + 1];
      i++;
    }
    if (args[i] === '--feature' && args[i + 1]) {
      parsed.feature = args[i + 1];
      i++;
    }
    if (args[i] === '--from' && args[i + 1]) {
      parsed.from = args[i + 1];
      i++;
    }
    if (args[i] === '--to' && args[i + 1]) {
      parsed.to = args[i + 1];
      i++;
    }
  }
  return parsed;
}

function filterEvents(events, { type, feature, from, to } = {}) {
  let filtered = events;
  if (type) {
    filtered = filtered.filter(e => e.type === type);
  }
  if (feature) {
    filtered = filtered.filter(e => e.feature === feature || e.payload?.feature === feature || e.payload?.slug === feature);
  }
  if (from) {
    filtered = filtered.filter(e => e.timestamp >= from);
  }
  if (to) {
    filtered = filtered.filter(e => e.timestamp <= to);
  }
  return filtered;
}

export async function auditShow() {
  const args = parseArgs();
  const events = loadEvents();
  const filtered = filterEvents(events, args);
  const limit = args.limit || 20;
  const shown = filtered.slice(-limit);

  console.log(`\n  Audit Trail (${shown.length} of ${filtered.length} events)\n`);

  if (shown.length === 0) {
    console.log('  No events found.');
    return 0;
  }

  for (const e of shown) {
    const time = e.timestamp ? e.timestamp.slice(0, 19).replace('T', ' ') : '?';
    const actor = e.actor?.id || e.actor?.type || '?';
    const sev = e.severity || 'info';
    console.log(`  ${time} | ${e.type.padEnd(24)} | ${sev.padEnd(8)} | ${actor}`);
  }

  console.log('');
  return 0;
}

export async function auditSearch() {
  const args = parseArgs();

  if (!args.type && !args.feature && !args.from) {
    console.error('Usage: ogu audit:search --type <event.type> [--feature <slug>] [--from <date>] [--to <date>]');
    return 1;
  }

  const events = loadEvents();
  const filtered = filterEvents(events, args);

  console.log(`\n  Search results: ${filtered.length} matched\n`);

  if (filtered.length === 0) {
    console.log('  No matching events found.');
    return 0;
  }

  const limit = args.limit || 50;
  const shown = filtered.slice(-limit);

  for (const e of shown) {
    const time = e.timestamp ? e.timestamp.slice(0, 19).replace('T', ' ') : '?';
    const actor = e.actor?.id || e.actor?.type || '?';
    console.log(`  ${time} | ${e.type.padEnd(24)} | ${actor}`);
  }

  console.log('');
  return 0;
}

export async function auditExport() {
  const args = parseArgs();
  const events = loadEvents();
  let filtered = filterEvents(events, args);
  if (args.limit) {
    filtered = filtered.slice(-args.limit);
  }
  console.log(JSON.stringify(filtered));
  return 0;
}

export async function auditReplay() {
  const args = parseArgs();
  const eventId = args.type; // reusing --type for event ID

  // Also check for --event flag
  const argv = process.argv.slice(3);
  let targetId = eventId;
  const eventIdx = argv.indexOf('--event');
  if (eventIdx >= 0 && argv[eventIdx + 1]) {
    targetId = argv[eventIdx + 1];
  }

  if (!targetId) {
    console.error('Usage: ogu audit:replay --event <eventId>');
    return 1;
  }

  const chain = replayChain(targetId);

  if (chain.length === 0) {
    console.log(`No event found with ID: ${targetId}`);
    return 1;
  }

  console.log(`\n  Replay Chain (${chain.length} events)\n`);
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    const time = e.timestamp.slice(0, 19).replace('T', ' ');
    const arrow = i === 0 ? '>' : ' ';
    console.log(`  ${arrow} ${time} | ${e.type.padEnd(24)} | ${e.severity.padEnd(8)} | ${e.id.slice(0, 8)}`);
    if (e.payload && typeof e.payload === 'object') {
      const summary = Object.keys(e.payload).slice(0, 3).join(', ');
      console.log(`    payload: { ${summary}${Object.keys(e.payload).length > 3 ? ', ...' : ''} }`);
    }
  }

  console.log('');
  return 0;
}
