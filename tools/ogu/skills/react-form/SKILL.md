---
name: react-form
description: Compiler skill for the react-form compiler. Activates when producing form-artifact.json. Gates: RF001–RF012. Upstream: optionally schema-artifact.json, route-artifact.json.
---

# react-form — Compiler Skill

## What This Compiler Does

Compiles a React form with full validation, per-field error display, loading state, and proper submit handling. Enforces that the form uses Zod for validation (via `zodResolver`), a native `<form>` element with `onSubmit`, every input has a label or `aria-label`, the submit button is disabled while submitting, and the submit handler calls the declared route. No `any`, no no-op submit handlers.

**Upstream dependency:** optionally `schema-artifact.json`, `route-artifact.json`
**Output artifact:** `form-artifact.json`
**IR identifier:** `FORM:{name}`

---

## Spec Shape

```json
{
  "name": "CreateUserForm",
  "fields": [
    { "name": "email",    "type": "email",    "required": true },
    { "name": "name",     "type": "string",   "required": true },
    { "name": "role",     "type": "select",   "options": ["admin", "member"] },
    { "name": "password", "type": "password", "required": true }
  ],
  "submitRoute": "/api/users",
  "auth": "required"
}
```

`name` — form component name.

`fields` — each field must have `name` and `type`.

`submitRoute` — API route path the form submits to. Referenced in the submit handler.

`auth` — `"required"` | `"optional"` | `"none"`. Indicates whether the route requires authentication.

---

## File Structure

| File | Purpose |
|---|---|
| `Form.tsx` | Main form component — validation, layout, submit handler |
| `form-schema.ts` | Zod schema — one field per spec field |
| `Form.test.tsx` | Tests — required |

---

## Gates

### RF001 — spec-valid
Reads `form-spec.json`. Fails if missing or invalid JSON.

Required fields: `name`, `fields[]` (non-empty, each with `name` and `type`), `submitRoute`, `auth`.

BAD: Missing `submitRoute`. Field without `type`. Empty `fields[]`.
GOOD:
```json
{
  "name": "LoginForm",
  "fields": [
    { "name": "email", "type": "email", "required": true },
    { "name": "password", "type": "password", "required": true }
  ],
  "submitRoute": "/api/auth/login",
  "auth": "none"
}
```

### RF002 — schema-valid
Reads `form-schema.ts`. Fails if missing.

Requirements:
- Imports `z` from `'zod'`
- Has a `z.object(` definition
- Has at least one `export const/type/default`
- Every `name` from `spec.fields` appears in the file

BAD: `form-schema.ts` uses `yup` instead of `zod`. Field `email` declared in spec but not in schema.
GOOD:
```ts
// form-schema.ts
import { z } from 'zod';

export const CreateUserFormSchema = z.object({
  email: z.string().email('Must be a valid email'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'member']),
});

export type CreateUserFormValues = z.infer<typeof CreateUserFormSchema>;
```

### RF003 — ts-valid
Runs `tsc --noEmit` in project root. Fails on any TypeScript error in `Form.tsx`.

Skipped if no `tsconfig.json` found.

### RF004 — no-any
Scans `Form.tsx` and `form-schema.ts`. Blocks:
- `: any` — TypeScript annotation
- `as any` — type cast
- `<any>` — generic any

BAD:
```tsx
const handleSubmit = async (data: any) => { ... }  // blocked
```
GOOD:
```tsx
const handleSubmit = async (data: CreateUserFormValues) => { ... }
```

### RF005 — labels-present
Every `<input>`, `<select>`, and `<textarea>` in `Form.tsx` must be labeled. Hidden inputs (`type="hidden"`) are exempt.

Passes if:
- `aria-label=` is present on the element
- A `<label htmlFor="fieldId">` exists where `id="fieldId"` matches the input

BAD:
```tsx
<input type="email" name="email" />  // no label, no aria-label
```
GOOD:
```tsx
<label htmlFor="email">Email</label>
<input type="email" id="email" name="email" />
// or
<input type="email" aria-label="Email address" />
```

### RF006 — error-display
`Form.tsx` must display validation errors per-field in JSX. At least one of these patterns required:
- `errors.fieldName.message` — react-hook-form standard
- `fieldState.error` — react-hook-form controller pattern
- `<FormMessage` — shadcn/ui
- `<ErrorMessage` — @hookform/resolvers
- `.error?.message` — generic error message

BAD:
```tsx
// Errors only logged to console — user never sees them
const onSubmit = async (data) => {
  try { ... } catch (e) { console.error(e); }
};
```
GOOD:
```tsx
<input {...register('email')} />
{errors.email && <span className="error">{errors.email.message}</span>}
// or with shadcn:
<FormMessage />
```

### RF009 — cross-schema
Skipped if no `schema-artifact.json` found in `{dir}/`, `{dir}/../`, or `{dir}/../schema/`.

When schema exists: every form field that is NOT a UI-only field must exist in the schema.

**UI-only fields exempt from schema check:**
`confirmPassword`, `passwordConfirm`, `terms`, `termsAccepted`, `agreeToTerms`, `captcha`, `recaptcha`, `rememberMe`, `newsletter`, `subscribeNewsletter`, `currentPassword`

BAD: form declares `organizationName` field but `User` schema has no such field.
GOOD: either add to schema or mark as UI-only in spec.

### RF010 — cross-route
Skipped if no `route-artifact.json` found.

When route artifact exists:
- `spec.submitRoute` must match the route artifact's `path`
- Every required field in the route's `input_schema.required[]` must exist in `spec.fields`

BAD: route requires `organizationId` but form has no such field.
GOOD: form includes all fields required by the route's input schema.

### RF011 — submit-handler
`Form.tsx` must have:
1. `<form onSubmit=...>` — native form element
2. `handleSubmit(` call or a named `onSubmit`/`handleSubmit`/`submitForm` function
3. The `spec.submitRoute` path referenced in the submit logic (not a no-op)

BAD:
```tsx
<div onClick={() => console.log('submitted')}>Submit</div>  // not a form
```
BAD:
```tsx
const onSubmit = (e) => { e.preventDefault(); }; // no-op
```
GOOD:
```tsx
const onSubmit = async (data: LoginFormValues) => {
  await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
};
// ...
<form onSubmit={handleSubmit(onSubmit)}>...</form>
```

### RF012 — contract-form
Five structural rules checked together:

| Rule | Requirement |
|---|---|
| `loading-state` | `isSubmitting`, `isPending`, or `isLoading` variable used |
| `disabled-on-submit` | Submit button: `disabled={isSubmitting}` or equivalent |
| `form-element` | `<form onSubmit=...>` not `<div onClick=...>` |
| `zod-resolver` | `zodResolver` from `@hookform/resolvers/zod` used |
| `per-field-errors` | Per-field error display (same check as RF006) |

BAD (double-submit risk):
```tsx
<button type="submit">Submit</button>  // not disabled during submission
```
GOOD:
```tsx
const { formState: { isSubmitting } } = useForm({ resolver: zodResolver(schema) });
// ...
<button type="submit" disabled={isSubmitting}>
  {isSubmitting ? 'Submitting...' : 'Submit'}
</button>
```

### coverage / no-todos / tests-pass
- **coverage**: ≥80% statement coverage on form files
- **no-todos**: `TODO`, `FIXME`, `HACK`, `XXX` blocked in all source files
- **tests-pass**: hard-fails if no test files found; vitest or jest must pass

---

## Complete Correct Form Pattern

```tsx
// Form.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateUserFormSchema, type CreateUserFormValues } from './form-schema';

export function CreateUserForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },  // RF012: loading-state
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(CreateUserFormSchema),  // RF012: zod-resolver
  });

  const onSubmit = async (data: CreateUserFormValues) => {
    await fetch('/api/users', {  // RF011: submitRoute referenced
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>  {/* RF011: form element */}
      <label htmlFor="email">Email</label>   {/* RF005: labeled */}
      <input id="email" type="email" {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}  {/* RF006: per-field error */}

      <label htmlFor="name">Name</label>
      <input id="name" type="text" {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}

      <button type="submit" disabled={isSubmitting}>  {/* RF012: disabled-on-submit */}
        {isSubmitting ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}
```

---

## What This Compiler Never Forgives

- `form-spec.json` missing (RF001 hard-fails)
- Field without `name` or `type` in spec (RF001)
- `form-schema.ts` missing or not importing from `'zod'` (RF002 hard-fails)
- Spec field not in `form-schema.ts` (RF002)
- `: any`, `as any`, or `<any>` in Form.tsx or form-schema.ts (RF004)
- `<input>` / `<select>` / `<textarea>` without `label` or `aria-label` (RF005)
- No per-field error display — only `console.error` or global toast (RF006)
- No loading state (`isSubmitting`/`isPending`/`isLoading`) (RF012)
- Submit button not disabled during submission (RF012)
- `<div onClick>` instead of `<form onSubmit>` (RF011, RF012)
- `zodResolver` not used (RF012)
- Submit handler is a no-op (RF011)
- `spec.submitRoute` not referenced in submit logic (RF011)
- No test files (tests-pass hard-fails)
