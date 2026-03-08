# UX Data Table Model Compiler

**Role:** Validate data table specs — column definitions, pagination requirements for large datasets, selection and bulk action state, loading and empty states, and sortable column alignment with API sort definitions.

---

## Your Output

```
data-table-spec.json       ← authored by UX designer or PM
data-table-artifact.json   ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "table_id": "invoices-table",
  "estimatedRowCount": 5000,
  "selectable": true,
  "loadingState": "skeleton",
  "emptyState": {
    "message": "No invoices found. Create your first invoice to get started.",
    "createAction": "Create Invoice"
  },
  "pagination": {
    "pageSize": 25,
    "required": true
  },
  "sortableColumns": ["issued_at", "total_amount", "due_date"],
  "selectionState": {
    "maxSelection": "unlimited",
    "bulkActions": [
      {
        "id": "bulk-export",
        "label": "Export Selected",
        "destructive": false
      },
      {
        "id": "bulk-delete",
        "label": "Delete Selected",
        "destructive": true,
        "confirmation": {
          "message": "Are you sure you want to delete the selected invoices? This action cannot be undone."
        }
      }
    ]
  },
  "columns": [
    { "id": "col-number", "label": "Invoice #", "field": "invoice_number", "sortable": false },
    { "id": "col-date", "label": "Date", "field": "issued_at", "sortable": true },
    { "id": "col-amount", "label": "Amount", "field": "total_amount", "sortable": true },
    { "id": "col-status", "label": "Status", "field": "status", "sortable": false }
  ],
  "sorts": [
    { "id": "sort-date", "label": "Date", "field": "issued_at", "defaultDirection": "desc" },
    { "id": "sort-amount", "label": "Amount", "field": "total_amount", "defaultDirection": "asc" }
  ]
}
```

---

## Hard Gates

### UDT002 — paging-required
Large datasets must declare valid pagination.

**BAD:**
```json
{ "estimatedRowCount": 10000, "pagination": { "pageSize": 0 } }
// pageSize is 0 — invalid for a 10,000-row dataset
```

**GOOD:**
```json
{ "estimatedRowCount": 10000, "pagination": { "pageSize": 25, "required": true } }
```

### UDT005 — empty-table
Every table must declare what to show when there are no rows.

**BAD:**
```json
{ "table_id": "orders-table", "columns": [...] }
// No emptyState — a blank table with no message is a broken experience
```

**GOOD:**
```json
{ "emptyState": { "message": "No orders yet. Place your first order.", "createAction": "New Order" } }
```

### UDT007 — bulk-actions-confirmation
Destructive bulk actions must require confirmation.

**BAD:**
```json
{ "id": "bulk-delete", "label": "Delete All", "destructive": true }
// No confirmation object — users can accidentally delete everything
```

**GOOD:**
```json
{ "id": "bulk-delete", "label": "Delete All", "destructive": true, "confirmation": { "message": "Delete all selected items? This cannot be undone." } }
```

---

## Contract

A spec that passes all gates:

- `version` declared
- `table_id` is a non-empty string
- All column ids are unique
- Every column has `id`, `label`, `field`
- `loadingState` is `skeleton`, `spinner`, or `overlay`
- `emptyState` has `message`
- `pagination.pageSize` is a number > 0
- If `estimatedRowCount > 25` or `pagination.required:true`: `pageSize` is 1-100
- If `selectable:true`: `selectionState` has `maxSelection` and `bulkActions`
- Any `column.sortable:true` column's `field` is in `spec.sortableColumns` or `spec.sorts`
- Any `bulkAction.destructive:true` has `confirmation.message`

---

## What You Never Do

- Do not omit `loadingState` — tables that load silently appear frozen
- Do not omit `emptyState` — blank tables communicate nothing to users
- Do not mark a column `sortable:true` without a corresponding sort definition
- Do not declare `selectable:true` without `selectionState.maxSelection` and `bulkActions`
- Do not add a destructive bulk action without a confirmation message
- Do not set `pageSize` to 0, negative, or above 100
- Do not use duplicate column ids — they break sort and filter bindings
- Do not skip `pagination.pageSize` for tables with `estimatedRowCount > 25`
