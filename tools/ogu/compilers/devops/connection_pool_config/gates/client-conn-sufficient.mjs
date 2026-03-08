import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'connection-pool-spec.json'), 'utf8'));

  const maxClientConn = spec.maxClientConn ?? spec.maxClients;
  const poolSize      = spec.poolSize ?? spec.maxConnections ?? spec.pool?.maxConnections;

  // If neither field is present, this check does not apply
  if (maxClientConn === undefined || poolSize === undefined) {
    return {
      pass: true, code: 'CP003',
      message: 'maxClientConn or poolSize not defined — skipped',
      skipped: true,
    };
  }

  if (typeof maxClientConn !== 'number' || typeof poolSize !== 'number') {
    return {
      pass: false, code: 'CP003',
      message: `maxClientConn and poolSize must be numbers (got ${typeof maxClientConn}, ${typeof poolSize})`,
    };
  }

  if (maxClientConn < poolSize) {
    return {
      pass: false, code: 'CP003',
      message: `maxClientConn (${maxClientConn}) < poolSize (${poolSize}) — pool will immediately exhaust available connections`,
      detail: 'maxClientConn must be >= poolSize. Otherwise clients queued for a pool slot will be rejected when the pool is saturated.',
    };
  }

  // Warn if headroom is less than 10% — causes connection queueing under normal load
  const headroom = maxClientConn - poolSize;
  const ratio = headroom / maxClientConn;
  if (ratio < 0.1 && !spec.skipHeadroomCheck) {
    return {
      pass: false, code: 'CP003',
      message: `Very tight connection headroom: only ${Math.round(ratio * 100)}% (${headroom} slots) between maxClientConn and poolSize`,
      detail: 'Less than 10% headroom causes queueing under normal load spikes. Add skipHeadroomCheck: true if intentional.',
    };
  }

  return {
    pass: true, code: 'CP003',
    message: `Connection headroom adequate: maxClientConn (${maxClientConn}) >= poolSize (${poolSize}) with ${headroom} slots of headroom`,
  };
}
