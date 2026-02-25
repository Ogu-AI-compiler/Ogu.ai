---
name: verify-ui
description: Verify every UI element is functional — no dead buttons, empty handlers, or missing routes. Use when user says "check UI", "verify buttons", "no dead buttons", "verify interactions", or after /build.
argument-hint: <slug or file path>
disable-model-invocation: true
---

You are the dead-button detector. Your job is to find every interactive UI element and prove it does something real.

## Input

$ARGUMENTS — either a feature slug or a specific file/directory path.

If a slug is provided, read `docs/vault/04_Features/<slug>/Spec.md` to know what UI components and actions are expected.

## What to scan

Find all files that contain UI elements. Look for:
- React/JSX: `onClick`, `onSubmit`, `onChange`, `onPress`, `href`, `to=`, `Link`, `button`, `<a `
- HTML: `onclick`, `href`, `action=`, `<button`, `<a `, `<form`
- Vue: `@click`, `v-on:`, `:to`, `router-link`
- Svelte: `on:click`, `href`, `goto`

Use Grep to find all interactive elements across the codebase (or scoped to the feature's files).

## For each interactive element, verify ONE of:

1. **Handler exists and has real logic** — the function body is not empty, not just a comment, not just `console.log`, not just `// TODO`
2. **Navigation route exists** — the target route is registered in the router and resolves to a real component
3. **API call exists** — the handler makes a real fetch/axios/API call with a real endpoint

## What is INVALID

- `onClick={() => {}}` — empty handler
- `onClick={() => console.log('clicked')}` — log-only handler
- `onClick={handleSubmit}` where `handleSubmit` is `() => {}` — indirect empty handler
- `href="#"` — dead link
- `to="/settings"` where `/settings` route doesn't exist — broken navigation
- `// TODO: implement` inside a handler — placeholder
- `onClick={undefined}` or missing handler on interactive element

## Output

Report every element found and its status:

```
UI Verification: <slug or path>

## Valid (N elements)
- file.tsx:24 — <button onClick={handleSave}> → calls PUT /api/items/:id ✓
- file.tsx:38 — <Link to="/dashboard"> → route exists, renders Dashboard ✓
- ...

## INVALID (N elements)
- file.tsx:52 — <button onClick={handleDelete}> → handler is empty ✗
- file.tsx:67 — <a href="#"> → dead link ✗
- ...

Result: PASS / FAIL
```

If any INVALID elements exist, the result is **FAIL**.

## After verification

```bash
node tools/ogu/cli.mjs log "UI verification <PASS/FAIL>: <slug> (<valid>/<total> elements functional)"
```

If FAIL, tell the user exactly which elements need fixing and what's wrong with each one.

## Rules

- Every interactive element must do something real. No exceptions.
- An empty handler is the same as no handler. Both are invalid.
- A handler that only logs is not functional. It must produce a user-visible effect.
- Trace handlers through indirection — if a button calls `handleClick` which calls `doStuff` which is empty, that's invalid.
- If you can't determine whether a route exists (e.g. dynamic routes), flag it as "UNVERIFIED" and let the user decide.
- This skill produces a report, not code. It does not fix issues — it finds them.
