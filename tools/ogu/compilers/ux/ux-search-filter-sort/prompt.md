# UX Search Filter Sort Compiler

**Role:** Validate the search, filter, and sort interaction model — ensuring filter types are recognized, no-results and loading states are defined, sort directions are explicit, and filter state persistence behavior is declared.

---

## Your Output

```
search-filter-sort-spec.json       ← authored by UX designer or PM
search-filter-sort-artifact.json   ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "entity": "invoice",
  "persistence": "url",
  "loadingState": {
    "type": "skeleton"
  },
  "noResultsState": {
    "message": "No invoices match your filters.",
    "clearFiltersAction": true,
    "suggestionsEnabled": false
  },
  "filters": [
    {
      "id": "status",
      "label": "Status",
      "type": "multi-select",
      "options": ["draft", "sent", "paid", "overdue"]
    },
    {
      "id": "amount-range",
      "label": "Amount",
      "type": "range",
      "min": 0,
      "max": 100000
    },
    {
      "id": "date-issued",
      "label": "Date Issued",
      "type": "date-range"
    },
    {
      "id": "has-attachments",
      "label": "Has Attachments",
      "type": "boolean"
    }
  ],
  "sorts": [
    {
      "id": "sort-date",
      "label": "Date",
      "field": "issued_at",
      "defaultDirection": "desc"
    },
    {
      "id": "sort-amount",
      "label": "Amount",
      "field": "total_amount",
      "defaultDirection": "asc"
    }
  ]
}
```

---

## Hard Gates

### USS003 — filter-types-valid
Every filter.type must be from the allowed set.

**BAD:**
```json
{ "id": "priority", "label": "Priority", "type": "dropdown" }
// "dropdown" is not a valid filter type — use "select" or "multi-select"
```

**GOOD:**
```json
{ "id": "priority", "label": "Priority", "type": "select", "options": ["low", "medium", "high"] }
```

### USS004 — sort-direction
Every sort entry must declare defaultDirection.

**BAD:**
```json
{ "id": "sort-name", "label": "Name", "field": "full_name" }
// Missing defaultDirection — initial sort is undefined
```

**GOOD:**
```json
{ "id": "sort-name", "label": "Name", "field": "full_name", "defaultDirection": "asc" }
```

### USS006 — filter-persistence
Filter state must declare a persistence policy.

**BAD:**
```json
{ "entity": "invoice", "filters": [...], "sorts": [...] }
// No persistence field — filters reset on every navigation
```

**GOOD:**
```json
{ "entity": "invoice", "persistence": "url", "filters": [...], "sorts": [...] }
```

---

## Contract

A spec that passes all gates:

- `version` declared
- `entity` is a non-empty string
- All filter ids are unique
- All sort ids are unique
- Every filter has `id`, `label`, `type` — type is in the allowed set
- Every sort has `id`, `label`, `field`, and `defaultDirection`
- `noResultsState` has `message` + at least one action, OR `noResultsHandledGlobally:true`
- `loadingState.type` is `skeleton`, `spinner`, or `progressive`, OR `loadingHandledGlobally:true`
- `persistence` is `session`, `url`, `none`, or `user-preference`

---

## What You Never Do

- Do not use a filter type outside the allowed set (`text`, `select`, `multi-select`, `range`, `date-range`, `boolean`, `tag`)
- Do not declare a sort without `defaultDirection`
- Do not omit `noResultsState` — users must know what to do when no results return
- Do not omit `loadingState` — searches without loading feedback appear broken
- Do not omit `persistence` — undefined persistence causes filter resets on navigation
- Do not use duplicate filter ids or sort ids — they create conflicting state
- Do not use `noResultsHandledGlobally:true` as an excuse to skip per-entity no-results UX that differs from the global default
