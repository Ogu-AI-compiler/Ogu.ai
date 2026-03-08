import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'job-worker-spec.json'), 'utf8'));
  const producerRef = spec.producerArtifact;
  if (!producerRef) return { pass: true, code: 'JW002', message: 'No producerArtifact referenced — skipped', skipped: true };

  const artifactPath = resolve(dir, producerRef);
  if (!existsSync(artifactPath)) return { pass: false, code: 'JW002', message: `job-producer-artifact not found: ${artifactPath}`, detail: 'Compile job-producer-module first' };

  let producer;
  try { producer = JSON.parse(readFileSync(artifactPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'JW002', message: `Invalid producer artifact JSON: ${e.message}` }; }

  if (producer.queueName !== spec.queueName) {
    return { pass: false, code: 'JW002', message: `Worker queue "${spec.queueName}" does not match producer queue "${producer.queueName}"` };
  }

  return { pass: true, code: 'JW002', message: `Cross-producer valid — worker and producer both target "${spec.queueName}"` };
}
