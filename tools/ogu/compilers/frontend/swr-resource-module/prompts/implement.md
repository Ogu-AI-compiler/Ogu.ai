# SWR Resource Module — Implementation Prompt

You are implementing a data-fetching hook using SWR.

## Spec
Read `swr-resource-spec.json` for:
- `resource`: resource name (e.g. `products`)
- `key_pattern`: SWR key pattern (e.g. `/api/products/{id}`)
- `revalidation`: revalidation strategy config

## Requirements

### SWR key
- Always parameterized: `['/api/products', id]` or `` `/api/products/${id}` ``
- Never a plain static string if params exist

### State shape
```typescript
const { data, error, isLoading } = useSWR<Product[]>(key, fetcher);
```
Always destructure `data`, `error`, `isLoading`.

### Revalidation
Declare at least one: `revalidateOnFocus`, `refreshInterval`, `revalidateIfStale`

### Pattern
```typescript
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useProducts(categoryId: string) {
  const { data, error, isLoading } = useSWR<Product[]>(
    categoryId ? ['/api/products', categoryId] : null,
    ([url, id]) => fetcher(`${url}?category=${id}`),
    { revalidateOnFocus: false, revalidateIfStale: true }
  );
  return { products: data ?? [], error, isLoading };
}
```

## Output
- `use[Resource].ts` — SWR hook
- `use[Resource].test.ts` — tests with mocked fetch
