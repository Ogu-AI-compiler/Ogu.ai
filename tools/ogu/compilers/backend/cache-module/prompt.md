# Cache Module Compiler

## Purpose
Compiles a typed cache access layer for a single cache family and namespace. One `cache-module` per cache family (e.g. `user-sessions`, `product-catalog`). Never a generic "all caches in one file" approach.

## Invariants (non-negotiable)

1. **Key from declared inputs** — The key builder must use exactly the parameters listed in `spec.keyInputs`. No extra inputs from global state, `Date.now()`, or random values. Keys must be deterministic.
2. **TTL from topology** — Never hardcode `redis.setEx(key, 3600, val)`. TTL comes from the topology artifact or a named constant from config. The number `3600` is forbidden inline.
3. **Miss propagates** — On cache miss, call the origin and return its result. Never return `null` silently and let the caller think it's a valid empty result.
4. **No write-back on failure** — If the origin call throws, do NOT write anything to cache. Writing failure states to cache makes the next N callers also see the failure.
5. **Invalidation scoped** — Only invalidate namespaces declared in `spec.invalidates`. No `FLUSHALL`, no wildcard deletes of unrelated namespaces.

## Standard Pattern (Redis + read-through)

```typescript
// products/products.cache.ts
import { redis } from '@/infrastructure/redis';
import { config } from '@/config';
import type { Product } from './product.types';

// keyInputs: ['productId']
function buildKey({ productId }: { productId: string }): string {
  return `product:v1:${productId}`;
}

export async function getCachedProduct(
  productId: string,
  origin: () => Promise<Product>
): Promise<Product> {
  const key = buildKey({ productId });
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as Product;

  // Miss — propagate to origin
  const product = await origin(); // throws on failure → no cache write
  await redis.set(key, JSON.stringify(product), { EX: config.cache.product.ttl });
  return product;
}

export async function invalidateProduct(productId: string): Promise<void> {
  const key = buildKey({ productId });
  await redis.del(key);
}
```

## spec format (`cache-spec.json`)
```json
{
  "family": "products",
  "namespace": "product:v1",
  "keyInputs": ["productId"],
  "pattern": "read-through",
  "invalidates": ["product:v1"],
  "topologyArtifact": "../../cache-topology/cache-topology-artifact.json"
}
```

## Patterns

| Pattern | Description |
|---------|-------------|
| `read-through` | Cache miss → call origin → store → return |
| `write-through` | Write to cache AND origin atomically |
| `cache-aside` | Caller controls cache population; module provides get/set/del primitives |

## Error codes

| Code  | Meaning                                                        |
|-------|----------------------------------------------------------------|
| CA001 | cache-spec.json missing or invalid                             |
| CA002 | cache-topology-artifact referenced but not found              |
| CA003 | Key builder missing or doesn't use all declared keyInputs      |
| CA004 | TTL hardcoded inline — must come from topology/config          |
| CA005 | Cache miss returns null without calling origin                 |
| CA006 | Cache write attempted inside catch block (on origin failure)   |
| CA007 | Invalidation targets namespace not in spec.invalidates         |
| CA008 | TODO/FIXME/HACK comment found                                  |
| CA009 | Tests failed                                                   |
| CA010 | Cache contract violation                                       |

## What NOT to do

- Do not use `redis.flushAll()` or wildcard deletes (`DEL *`) anywhere.
- Do not cache error responses (HTTP 4xx/5xx, thrown exceptions).
- Do not use `Math.random()` or `Date.now()` in key builders — keys must be deterministic.
- Do not manage TTL by checking `createdAt` in the cached object — let Redis expire it.
- Do not share key builders between different cache families.
