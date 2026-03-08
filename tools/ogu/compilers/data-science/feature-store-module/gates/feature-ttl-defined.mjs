import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * FS005 — feature-ttl-defined
 * Online feature store feature groups must declare a TTL (time-to-live)
 * to prevent serving stale features to production models.
 *
 * Why:
 * - Online feature stores cache precomputed features for low-latency serving.
 *   Without TTL, a feature computed for user 123 yesterday remains in the
 *   store indefinitely. If that user's behavior changed today, the model
 *   receives yesterday's features — a silent, invisible data quality issue.
 * - The impact of stale features depends on feature volatility:
 *   - "account_age" changes slowly → long TTL (30+ days) acceptable
 *   - "items_in_cart" changes per session → short TTL (minutes/hours)
 *   - "recent_purchase_count_7d" changes daily → TTL = 24 hours
 * - TTL also controls storage growth: without expiry, the online store
 *   accumulates entries for users who never return, wasting memory.
 * - Feast, Hopsworks, and Redis feature stores all support TTL.
 *   Not declaring it means accepting the system default (often infinite).
 *
 * Escape hatch: set store_type: "offline" in spec for offline-only feature
 * groups where TTL is not applicable (batch training data, not online serving).
 */

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'feature-store-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'FS005', message: 'feature-store-spec.json not readable' }; }

  // Offline-only stores don't need TTL
  if (spec.store_type === 'offline') {
    return { pass: true, code: 'FS005', message: 'Offline-only feature store — TTL not required', skipped: true };
  }

  const hasTTL = spec.ttl_days != null || spec.ttl_hours != null || spec.ttl != null || spec.max_age_days != null;

  if (spec.store_type === 'online' && !hasTTL) {
    return {
      pass: false, code: 'FS005',
      message: 'Online feature store requires TTL — stale features degrade model performance silently',
      detail: 'Add TTL to feature-store-spec.json:\n' +
        '  "ttl_days": 7\n' +
        '  OR "ttl_hours": 24\n\n' +
        'TTL guidance by feature volatility:\n' +
        '  Slow (account_age):        ttl_days: 30\n' +
        '  Daily (purchase_count_7d): ttl_hours: 24\n' +
        '  Session (cart_items):      ttl_hours: 1\n\n' +
        'Or set "store_type": "offline" if this group is batch-only.',
    };
  }

  // Check Python code for TTL usage
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (pyFiles.length) {
    const content = pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
    const hasTTLInCode = /\bttl\s*=|max_age|freshness_threshold|timedelta|TTL\s*=/.test(content);

    if (!hasTTL && !hasTTLInCode) {
      return {
        pass: false, code: 'FS005',
        message: 'No TTL defined in spec or code — features may never expire',
        detail: 'Add ttl_days to spec or use timedelta in feature group registration:\n' +
          '  FeatureGroup(name="user_features", ttl=timedelta(days=7))',
      };
    }
  }

  const ttlValue = spec.ttl_days != null ? `${spec.ttl_days}d`
    : spec.ttl_hours != null ? `${spec.ttl_hours}h`
    : spec.ttl ?? 'code-defined';

  return { pass: true, code: 'FS005', message: `Feature TTL defined: ${ttlValue}` };
}
