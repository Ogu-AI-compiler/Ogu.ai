---
name: backend-test-module
description: Compiler skill for the backend-test-module compiler. Activates when producing test-module-artifact.json. Gates: BT001–BT009. No upstream dependency.
---

# backend-test-module — Compiler Skill

## What This Compiler Does

Compiles a backend test suite from a behavior spec. Enforces that every declared scenario has at least one test, no real network calls are made in unit tests, shared mutable state is prohibited between tests, mocks are typed (no `as any`), and assertions use specific value checks rather than truthiness alone.

**Upstream dependency:** none
**Output artifact:** `test-module-artifact.json`
**IR identifier:** `TEST_MODULE:{module}`
**Files you create:** `test-module-spec.json`, test file(s) (e.g. `module.test.ts`)

---

## Spec Shape

```json
{
  "module": "user-service",
  "scenarios": [
    {
      "id": "scenario-001",
      "description": "Creates a user with valid input",
      "given": "no user with that email exists",
      "when": "createUser is called with valid email and name",
      "then": "returns the created user with an id and createdAt timestamp"
    },
    {
      "id": "scenario-002",
      "description": "Throws if email already taken",
      "when": "createUser is called with a duplicate email",
      "then": "throws DuplicateEmailError"
    }
  ]
}
```

`given` is optional. `when` and `then` are required for every scenario.

---

## Gates

### BT001 — spec-valid
Reads `test-module-spec.json`. Fails if missing.

Required top-level fields: `module` (string), `scenarios` (non-empty array).

Required per-scenario fields: `id`, `description`, `when`, `then`.

BAD: Scenario missing `then` — the expected outcome is required. `"scenarios": []` — must have at least one.
GOOD: Every scenario has `id`, `description`, `when`, and `then`.

### BT002 — scenarios-covered
Each scenario in the spec must be represented in at least one test file. A scenario is considered covered if either:
- Its `id` appears as a string in any test file, OR
- The first 20 characters of its `description` appear in any test file

Fails if no test files are found at all.

BAD: Spec has `"id": "scenario-002"` but no test file mentions `"scenario-002"` or `"Throws if email"`.
GOOD: Test file has `it("scenario-002: Throws if email already taken", ...)` or `describe("scenario-002", ...)`.

### BT003 — no-real-network
Scans all test files (`*.test.ts`, `*.spec.ts`, `*.test.mjs`, etc.).

**File-level bypass:** If a test file uses a mock setup at the module level (`vi.mock`, `jest.mock`, `nock`, `msw`, `setupServer`, `interceptors.request`), the entire file is considered safe and skipped.

Otherwise, any line containing a real HTTP call fails:
- `fetch(`
- `axios.get(`, `axios.post(`, `axios.put(`, `axios.patch(`, `axios.delete(`, `axios.request(`
- `http.request(`, `https.request(`
- `got(`, `ky.(`

Skips (passes) if no test files found.

BAD:
```ts
// No mock setup at top of file
it("should fetch users", async () => {
  const res = await fetch("https://api.example.com/users"); // real network call
});
```
GOOD:
```ts
vi.mock("./http-client"); // module-level mock — file is safe
it("should fetch users", async () => {
  const res = await fetch("https://api.example.com/users");
});
```

### BT004 — no-shared-state
Detects `let` or `var` declarations at module level (depth 0, outside all `describe`/`it`/function blocks) that are then mutated inside `it(`, `test(`, or `beforeAll(` blocks.

Mutation patterns checked: `=` (assignment), `.push(`, `.pop(`, `.shift(`, `.splice(`.

Skips if no test files found.

BAD:
```ts
let results: User[] = []; // module-level mutable

it("accumulates results", async () => {
  results.push(await createUser());  // mutates shared state
});
```
GOOD:
```ts
let results: User[];

beforeEach(() => {
  results = []; // reset before every test
});

it("creates a user", async () => {
  results.push(await createUser());
});
```

### BT005 — typed-mocks
Only applies to TypeScript test files (`*.test.ts`, `*.spec.ts`). Skips `.mjs`/`.js` test files.

Blocked patterns:
- `mockResolvedValue(... as any)` — typed as `any`
- `mockReturnValue(... as any)` — typed as `any`

BAD:
```ts
vi.fn().mockResolvedValue({ id: "1" } as any); // any type
jest.fn().mockReturnValue({ result: true } as any);
```
GOOD:
```ts
vi.fn<() => Promise<User>>().mockResolvedValue({ id: "1", name: "Alice", email: "a@b.com" });
(mockFind as jest.MockedFunction<typeof db.find>).mockResolvedValue([]);
```

### BT006 — no-weak-assertions
`expect(x).toBeTruthy()`, `expect(x).toBeFalsy()`, and `expect(x).toBeDefined()` are considered weak when used alone.

A weak assertion only fails if there is **no strong assertion** within 3 lines before or after it. Strong assertions: `toBe(`, `toEqual(`, `toStrictEqual(`, `toHaveLength(`, `toContain(`, `toMatchObject(`, `toThrow(`, `toHaveBeenCalledWith(`.

This means: weak assertions alongside value checks are fine. Weak assertions with no nearby value check fail.

BAD:
```ts
const user = await createUser(input);
expect(user).toBeTruthy(); // no value check nearby — what exactly is truthy?
```
GOOD:
```ts
const user = await createUser(input);
expect(user.id).toBe("abc-123");
expect(user.email).toEqual("test@example.com");
```

### BT007 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files (excluding `.d.ts`, `node_modules`, `dist`, `.git`).

Blocked markers: `TODO`, `FIXME`, `HACK` (word-boundary match).

### BT008 — tests-pass
Finds all `*.test.ts`, `*.spec.ts`, `*.test.mjs`, etc. in the module directory.

**Hard-fails** if no test files found.

Tries vitest first, then jest. Fails if neither test runner is installed. All tests must pass.

### BT009 — contract-test-module
Reads `test-module-artifact.json`. Required fields: `ir_id`, `module`, `scenarios_covered`, `test_files`, `attestation`.

- `ir_id` must start with `TEST_MODULE:`
- `attestation.hash` must be present
- `scenarios_covered` must be ≥ number of scenarios in the spec

This artifact is generated by the compiler — do not create it manually.

---

## What This Compiler Never Forgives

- `test-module-spec.json` missing (BT001 hard-fails)
- Scenarios without `when` or `then` (BT001 hard-fails)
- Any spec scenario not mentioned in any test file (BT002)
- Real `fetch(` / `axios.*` / `http.request(` in test files without a module-level mock (BT003)
- No test files at all (BT002 and BT008 both hard-fail)
- Mock returns typed as `as any` in TypeScript test files (BT005)
- `expect(x).toBeTruthy()` used as the only assertion with no value check nearby (BT006)
