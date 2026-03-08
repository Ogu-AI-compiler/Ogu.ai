import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'event-consumer-spec.json'), 'utf8'));
  const ref = spec.publisherArtifact;
  if (!ref) return { pass: true, code: 'EC002', message: 'No publisherArtifact referenced — skipped', skipped: true };
  const artifactPath = resolve(dir, ref);
  if (!existsSync(artifactPath)) return { pass: false, code: 'EC002', message: `event-publisher-artifact not found: ${artifactPath}` };
  let pub;
  try { pub = JSON.parse(readFileSync(artifactPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'EC002', message: `Invalid publisher artifact: ${e.message}` }; }
  if (pub.eventType !== spec.eventType) {
    return { pass: false, code: 'EC002', message: `Consumer eventType "${spec.eventType}" ≠ publisher eventType "${pub.eventType}"` };
  }
  const publishedChannel = pub.channel;
  if (!spec.channels.includes(publishedChannel)) {
    return { pass: false, code: 'EC002', message: `Publisher channel "${publishedChannel}" not in consumer channels: [${spec.channels.join(', ')}]` };
  }
  return { pass: true, code: 'EC002', message: `Cross-publisher valid — "${spec.eventType}" on channel "${publishedChannel}"` };
}
