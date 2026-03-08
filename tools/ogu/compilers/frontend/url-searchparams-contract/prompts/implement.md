# URL SearchParams Contract — Implementation Prompt

You are implementing a typed URL search params contract for a Next.js/React application.

## Spec
Read `searchparams-spec.json` in the target directory for:
- `params`: array of param definitions with name, type, default
- `route`: the route this applies to

## Requirements

### Files to create
1. `searchparams.ts` — main contract implementation

### Contract rules (all must pass)
- `parse(searchParams: URLSearchParams): Params` — exported, total (no throws), uses `?? default` for missing values
- `serialize(params: Params): string` — exported, uses `URLSearchParams`, sorts keys for canonicality, omits values equal to defaults
- `interface [Name]Params` or `type [Name]Params =` — typed schema
- No `: any` in types

### Pattern
```typescript
export interface ProductListParams {
  page: number;
  sort: 'price' | 'name' | 'date';
  category: string | null;
}

export function parse(sp: URLSearchParams): ProductListParams {
  return {
    page: Number(sp.get('page') ?? '1'),
    sort: (sp.get('sort') as ProductListParams['sort']) ?? 'date',
    category: sp.get('category'),
  };
}

export function serialize(params: ProductListParams): string {
  const entries: [string, string][] = [];
  if (params.page !== 1) entries.push(['page', String(params.page)]);
  if (params.sort !== 'date') entries.push(['sort', params.sort]);
  if (params.category != null) entries.push(['category', params.category]);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries).toString();
}
```

## Output
- `searchparams.ts`
- `searchparams.test.ts` — tests for parse/serialize roundtrip, default omission, edge cases
