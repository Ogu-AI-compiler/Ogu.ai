---
name: state-store
description: Compiler skill for the state-store compiler. Activates when producing store-artifact.json. Gates: SS001–SS012. No upstream dependency.
---

# state-store — Compiler Skill

## What This Compiler Does

Compiles a client-side state store. Supports Zustand and Redux Toolkit. Enforces typed state interfaces, immutable updates (no direct mutations outside Immer contexts), pure selectors (no side effects in `select*` functions), no async logic in sync reducers (Redux), and engine-specific structural contracts.

**Upstream dependency:** none
**Output artifact:** `store-artifact.json`
**IR identifier:** `STORE:{name}`

---

## Spec Shape

```json
{
  "name": "userStore",
  "engine": "zustand",
  "state": {
    "currentUser": "User | null",
    "isEditing": "boolean",
    "editDraft": "Partial<User> | null"
  }
}
```

OR for Redux Toolkit:
```json
{
  "name": "auth",
  "engine": "redux-toolkit",
  "state": {
    "user": "User | null",
    "token": "string | null",
    "status": "idle | loading | succeeded | failed"
  }
}
```

`engine` must be one of: `zustand` | `redux-toolkit` | `redux`

`state` — object describing the shape. Values are type strings (used as documentation, not enforced).

---

## Gates

### SS001 — spec-valid
Reads `store-spec.json`. Fails if missing or invalid JSON.

Required fields: `name`, `engine` (zustand|redux-toolkit|redux), `state` (object).

BAD: `"engine": "jotai"` — not in valid set. `state` is an array instead of object.
GOOD:
```json
{
  "name": "cartStore",
  "engine": "zustand",
  "state": { "items": "CartItem[]", "total": "number" }
}
```

### SS002 — naming-valid
Engine-specific file naming:

**Zustand**: must have a file with `Store` or `store` in its name. That file must call `create(` or `createStore(`.
```ts
// useCartStore.ts
const useCartStore = create<CartState>()(...)
```

**Redux Toolkit**: must have a file with `Slice` or `slice` in its name. That file must call `createSlice(`.
```ts
// authSlice.ts
const authSlice = createSlice({...})
```

### SS005 — immutable-updates
**Zustand without Immer**: direct `state.property = value` mutation inside `set()` callback is blocked unless the file imports `immer` or uses `produce()`.

```ts
// BAD (zustand without immer)
set((state) => { state.count = 5; }); // direct mutation

// GOOD (zustand with spread)
set((state) => ({ ...state, count: 5 }));

// ALSO GOOD (zustand + immer middleware)
import { produce } from 'immer';
set(produce((state) => { state.count = 5; })); // immer allowed
```

**Redux Toolkit**: RTK uses Immer internally, so direct mutations inside `reducers:` are fine. But mutations outside the `reducers:` block are flagged:
```ts
// BAD — mutating outside reducer
const prevState = store.getState();
prevState.user.name = 'John'; // not inside createSlice
```

### SS006 — no-async-reducer
**Zustand**: skipped — Zustand allows async actions.

**Redux / Redux Toolkit**: `async`, `await`, `.then(`, `fetch(`, or `axios.` inside the `reducers:` block are blocked. Use `createAsyncThunk` + `extraReducers` for async logic.

BAD:
```ts
reducers: {
  fetchUser: async (state, action) => { // async in sync reducer
    const user = await api.getUser(action.payload);
    state.user = user;
  }
}
```
GOOD:
```ts
export const fetchUser = createAsyncThunk('auth/fetchUser', async (id: string) => {
  return api.getUser(id);
});

// in createSlice:
extraReducers: (builder) => {
  builder.addCase(fetchUser.fulfilled, (state, action) => {
    state.user = action.payload;
  });
}
```

### SS007 — selectors-pure
All exported `select*` functions must be pure. Blocked inside selectors (first ~15 lines):
- `Math.random()`, `Date.now()`, `new Date()` — non-deterministic
- `localStorage.`, `sessionStorage.` — storage reads
- `fetch(`, `axios.` — network calls

Also: if a selector returns a new array (`=> [...]`) or object (`=> {...}`), `createSelector` or `useMemo` must be used in the file to prevent re-renders on every call.

BAD:
```ts
export const selectFilteredUsers = (state: RootState) =>
  state.users.filter(u => u.active).map(u => ({...u, label: u.name}));
// new array + new objects on every call — triggers re-renders
```
GOOD:
```ts
export const selectFilteredUsers = createSelector(
  (state: RootState) => state.users,
  (users) => users.filter(u => u.active).map(u => ({...u, label: u.name}))
  // memoized — same reference if users hasn't changed
);
```

### SS012 — contract-store
Engine-specific contract rules:

**Zustand contract:**
| Rule | Requirement |
|---|---|
| `typed-state` | `interface FooState { ... }` or `type FooState = { ... }` must exist |
| `devtools` | `devtools` middleware used OR `process.env.NODE_ENV` check |
| `exported-selectors` | At least one `export const select*` or `export const use*` |

**Redux Toolkit contract:**
| Rule | Requirement |
|---|---|
| `slice-actions-exported` | `export const { action1, action2 } = sliceName.actions` |
| `reducer-exported` | `export default sliceName.reducer` as default export |
| `typed-initial-state` | `initialState: StateType = ...` or `initialState as StateType` |

BAD (Zustand without typed state):
```ts
// useCartStore.ts
const useCartStore = create()((set) => ({
  items: [], // no interface
  add: (item) => set(s => ({items: [...s.items, item]})),
}));
```
GOOD:
```ts
interface CartState {
  items: CartItem[];
  total: number;
  add: (item: CartItem) => void;
  clear: () => void;
}

const useCartStore = create<CartState>()(devtools((set) => ({
  items: [],
  total: 0,
  add: (item) => set(s => ({ items: [...s.items, item], total: s.total + item.price })),
  clear: () => set({ items: [], total: 0 }),
})));

export const selectItems = (state: CartState) => state.items;
export const selectTotal = (state: CartState) => state.total;
```

### cross-schema / no-any / no-todos / tests-pass / coverage
Standard gates — schema alignment, no `any`, no TODOs, tests must pass, ≥80% coverage.

---

## What This Compiler Never Forgives

- `store-spec.json` missing (SS001 hard-fails)
- `engine` not in `zustand` | `redux-toolkit` | `redux` (SS001)
- No file with `Store`/`store` for Zustand or `Slice`/`slice` for Redux (SS002 hard-fails)
- `create(` not found in Zustand store file (SS002)
- `createSlice(` not found in Redux slice file (SS002)
- Direct `state.property = value` in Zustand without Immer (SS005)
- `async`/`await`/`fetch` inside Redux sync `reducers:` block (SS006)
- Selector using `Math.random()`, `localStorage`, or `fetch()` (SS007)
- Selector returning new array/object without `createSelector` (SS007)
- No `interface FooState` in Zustand store (SS012)
- No `export const { ... } = slice.actions` in Redux (SS012)
- No `export default slice.reducer` in Redux (SS012)
- No test files (tests-pass hard-fails)
