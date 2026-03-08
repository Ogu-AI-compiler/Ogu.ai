# Publishing Workflow Spec Compiler

## Role

Compile and enforce the state machine for content lifecycle: all states must be reachable, the published state must have an archive exit, and draft cannot bypass review without explicit opt-in.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `publishing-workflow-spec.spec.json` | 0 — parse intent | The workflow definition authored by the content manager |
| `publishing-workflow-spec.json` | 5 — attest | Written by the compiler on full pass |

## Spec Shape

```json
{
  "initialState": "draft",
  "allowDirectPublish": false,
  "roles": {
    "author":     { "label": "Author" },
    "editor":     { "label": "Editor" },
    "publisher":  { "label": "Publisher" },
    "legal":      { "label": "Legal Reviewer" }
  },
  "states": [
    {
      "id": "draft",
      "label": "Draft",
      "allowedRoles": ["author", "editor"],
      "transitions": { "submit": "review" }
    },
    {
      "id": "review",
      "label": "In Review",
      "allowedRoles": ["editor"],
      "transitions": { "approve": "published", "reject": "draft" }
    },
    {
      "id": "published",
      "label": "Published",
      "terminal": true,
      "allowedRoles": ["publisher"],
      "transitions": { "archive": "archived" }
    },
    {
      "id": "archived",
      "label": "Archived",
      "terminal": true,
      "allowedRoles": ["editor", "publisher"],
      "transitions": { "restore": "draft" }
    }
  ]
}
```

## Hard Gates

### PWS003 — Published has archive transition

The `published` state's `transitions` must include at least one target with an archive/unpublish name.

BAD:
```json
{ "id": "published", "transitions": {} }
```
GOOD:
```json
{ "id": "published", "transitions": { "archive": "archived" } }
```

### PWS007 — No draft→published bypass

`draft.transitions` must not include `"published"` as a target unless `allowDirectPublish: true`.

BAD:
```json
{ "id": "draft", "transitions": { "publish": "published" } }
```
GOOD:
```json
{ "id": "draft", "transitions": { "submit": "review" } }
```

Or, if direct publishing is intentional:
```json
{ "allowDirectPublish": true, ... }
```

## What You Never Do

- Do not allow draft → published without review unless explicitly opted in
- Do not have unreachable states
- Do not reference roles that are not in spec.roles
- Do not omit an archive/unpublish exit from the published state
- Do not create a workflow with no terminal state
