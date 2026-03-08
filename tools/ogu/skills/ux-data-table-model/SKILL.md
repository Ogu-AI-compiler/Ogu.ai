---
name: ux-data-table-model
description: Compiler skill for the ux-data-table-model compiler. Activates when producing data-table-artifact.json. Gates: UDT001–UDT008. No upstream dependency.
---

# ux-data-table-model — Compiler Skill

## What This Compiler Does

Compiles the data table model specification — columns, pagination, selection, loading/empty states, sorting, bulk actions, and confirmation dialogs. Enforces: pagination when large datasets, selection requires maxSelection + bulk actions, loading state declared, empty state with message, sortable columns have sort entries, destructive bulk actions have confirmation messages.

**Upstream dependency:** none
**Output artifact:** `data-table-artifact.json`
**IR identifier:** `DATA_TABLE_MODEL:{project}`

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "table_id": "orders-table",
  "columns": [
    { "id": "order-id", "label": "Order ID", "sortable": true },
    { "id": "status", "label": "Status" }
  ],
  "pagination": { "required": true, "pageSize": 25 },
  "selectable": true,
  "selectionState": { "maxSelection": 100 },
  "bulkActions": [
    { "id": "delete", "label": "Delete", "destructive": true, "confirmation": { "message": "Delete selected orders?" } }
  ],
  "loadingState": "skeleton",
  "emptyState": { "message": "No orders found" },
  "sortableColumns": ["order-id"]
}
```

Required fields:
- `table_id` — string
- `columns` — non-empty array, each with `id` and `label`
- `pagination.pageSize` — declared

---

## Gates

### UDT001 — spec-valid
Reads `data-table-spec.json`. Returns `skipped: true` if file not found. Required: `table_id` (string), `columns` (non-empty array, each with `id` + `label`), `pagination.pageSize` (declared).

### UDT002 — pagination-required
If `estimatedRowCount > 25` OR `pagination.required: true`, then `pagination.pageSize` must be between 1 and 100.

BAD:
```json
{ "estimatedRowCount": 1000, "pagination": { "pageSize": 0 } }
// large dataset, invalid pageSize
```
GOOD:
```json
{ "estimatedRowCount": 1000, "pagination": { "required": true, "pageSize": 25 } }
```

### UDT003 — selection-model
If `selectable: true`: `selectionState.maxSelection` (positive number) and `bulkActions` (non-empty array) are both required. Selection without bulk actions is purposeless.

BAD:
```json
{ "selectable": true }
// missing selectionState.maxSelection and bulkActions
```
GOOD:
```json
{
  "selectable": true,
  "selectionState": { "maxSelection": 50 },
  "bulkActions": [{ "id": "export", "label": "Export" }]
}
```

### UDT004 — loading-state-declared
`spec.loadingState` must be one of: `"skeleton"`, `"spinner"`, `"overlay"`. Missing loading state means undefined behavior while data fetches.

BAD: `loadingState` missing.
BAD: `"loadingState": "pulse"` — not in valid list.
GOOD: `"loadingState": "skeleton"`

### UDT005 — empty-state-message
`spec.emptyState.message` must be a non-empty string. Empty tables without a message leave users confused.

BAD: `emptyState` missing or `emptyState.message` empty.
GOOD: `{ "emptyState": { "message": "No records found. Try adjusting your filters." } }`

### UDT006 — sortable-columns-declared
Every column with `sortable: true` must have a corresponding entry in `spec.sortableColumns` (array) or `spec.sorts` (array with matching `field`). Declaring a column sortable without the sort configuration creates a non-functional UI control.

BAD:
```json
{ "columns": [{ "id": "name", "sortable": true }], "sortableColumns": [] }
// "name" is sortable but not in sortableColumns
```
GOOD:
```json
{ "columns": [{ "id": "name", "sortable": true }], "sortableColumns": ["name"] }
```

### UDT007 — bulk-action-confirmation
Every bulk action with `destructive: true` must declare `confirmation.message` (non-empty string). Destructive actions without confirmation can cause data loss.

BAD:
```json
{ "id": "delete", "destructive": true }
// missing confirmation.message
```
GOOD:
```json
{ "id": "delete", "destructive": true, "confirmation": { "message": "Permanently delete selected items?" } }
```

### UDT008 — contract-data-table
Final contract check: `version` declared, unique column ids, `pagination.pageSize > 0`.

---

## What This Compiler Never Forgives

- `data-table-spec.json` missing (UDT001 skips — not hard-fail)
- `table_id`, `columns`, or `pagination.pageSize` missing (UDT001)
- `estimatedRowCount > 25` or `pagination.required: true` with invalid `pageSize` (UDT002)
- `selectable: true` without `selectionState.maxSelection` or `bulkActions` (UDT003)
- `loadingState` missing or invalid (UDT004)
- `emptyState.message` missing or empty (UDT005)
- Sortable column not in `sortableColumns` or `sorts` (UDT006)
- `destructive: true` bulk action without `confirmation.message` (UDT007)
- `version` missing or duplicate column ids (UDT008)
