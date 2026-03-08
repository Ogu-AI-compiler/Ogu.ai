# Backend Test Module Compiler

## Purpose
Compiles a backend test suite from a behavior spec. Every scenario declared in the spec must be tested. Tests must be isolated, typed, and make specific assertions.

## Invariants (non-negotiable)

1. **Scenario coverage** — Every `scenario.id` in `test-module-spec.json` must appear in at least one test file. No untested scenarios ship.
2. **No real network** — Unit tests do not make real HTTP calls. Use `vi.mock`, `jest.mock`, MSW, or `nock`. Integration tests that need real network belong in a separate `integration/` folder and are opt-in.
3. **No shared mutable state** — No `let items = []` at module level that tests push into. Reset state in `beforeEach`. Shared state creates test-order dependencies.
4. **Typed mocks** — Mock return values are typed. `vi.fn<() => Promise<User>>()`, not `vi.fn()`. `mockResolvedValue({ id: '1' } as User)`, not `mockResolvedValue({} as any)`.
5. **Specific assertions** — `expect(result).toEqual({ id: '1', status: 'active' })`, not just `expect(result).toBeTruthy()`. Truthiness checks alone do not verify behavior.

## Standard Pattern

```typescript
// users/users.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersService } from './users.service';
import type { User } from './user.types';

// Typed mock — no any
const mockRepo = {
  findById: vi.fn<(id: string) => Promise<User | null>>(),
  save: vi.fn<(user: User) => Promise<User>>(),
};

describe('UsersService', () => {
  let service: UsersService;

  // Reset in beforeEach — no shared mutable state
  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService(mockRepo);
  });

  // Scenario: USER_001 — returns user when found
  it('USER_001: returns user when found by id', async () => {
    const user: User = { id: '1', name: 'Alice', status: 'active' };
    mockRepo.findById.mockResolvedValue(user);

    const result = await service.getUser('1');

    // Specific assertion — not just toBeTruthy
    expect(result).toEqual(user);
    expect(mockRepo.findById).toHaveBeenCalledWith('1');
  });

  // Scenario: USER_002 — throws when not found
  it('USER_002: throws NotFoundError when user does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.getUser('999')).rejects.toThrow('User not found');
  });
});
```

## spec format (`test-module-spec.json`)
```json
{
  "module": "users.service",
  "scenarios": [
    {
      "id": "USER_001",
      "description": "returns user when found by id",
      "given": "user exists in repository",
      "when": "getUser(id) is called",
      "then": "returns the User object"
    },
    {
      "id": "USER_002",
      "description": "throws NotFoundError when user does not exist",
      "given": "user not in repository",
      "when": "getUser(id) is called",
      "then": "throws NotFoundError"
    }
  ]
}
```

## Error codes

| Code  | Meaning                                                        |
|-------|----------------------------------------------------------------|
| BT001 | test-module-spec.json missing or invalid                       |
| BT002 | One or more scenarios have no corresponding test               |
| BT003 | Real network call in unit test without mock                    |
| BT004 | Shared mutable state mutated between tests                     |
| BT005 | Mock return value typed as any/unknown                         |
| BT006 | Weak assertion (toBeTruthy alone) with no value check          |
| BT007 | TODO/FIXME/HACK comment found                                  |
| BT008 | Tests failed                                                   |
| BT009 | Test module contract violation                                 |

## What NOT to do

- Do not use `jest.spyOn(module, 'fn').mockImplementation(() => {})` and forget to restore — use `vi.clearAllMocks()` in `beforeEach`.
- Do not `expect.assertions(N)` and then write the wrong number — just write the assertions.
- Do not test implementation details (private methods, internal state) — test public API behavior.
- Do not put `console.log` in tests — use `expect` instead.
- Do not write a single test that covers multiple scenarios — one scenario = one `it` block.
