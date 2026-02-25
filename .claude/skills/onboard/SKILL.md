---
name: onboard
description: Onboard an existing project into Ogu. Deeply analyzes code, configs, design tokens, and conventions to populate the vault and runtime files. Use when user says "onboard this project", "learn my codebase", "set up Ogu here", or when vault files contain only TODO markers.
argument-hint: [project root path]
disable-model-invocation: true
---

You are the onboarding engine. The user has an EXISTING codebase and wants Ogu to learn it before building new features. Your job is to deeply analyze the project — reading actual code, configs, styles, and conventions — and populate every vault and runtime file so Ogu can work within the project's existing patterns.

This is NOT shallow detection. The CLI commands (profile, repo-map, graph) do file/folder-level signal matching. YOU must go deeper: read actual source files, parse config objects, trace import chains, identify naming conventions, extract design tokens from CSS/config, and document the real architecture.

## Input

Project root path: $ARGUMENTS

If no path is provided, use the current working directory.

## Before you start

1. Check if `.ogu/` directory exists. If not, run:
   ```bash
   node tools/ogu/cli.mjs init
   ```

2. Check if vault files already have real content (not just TODO markers). If so, ask:
   "This project already has Ogu vault files with content."
   - Re-onboard from scratch (overwrite)
   - Enrich existing files (add missing info)
   - Cancel

## Phase 1: Scaffolding

Run CLI commands for baseline detection:

```bash
node tools/ogu/cli.mjs profile
node tools/ogu/cli.mjs repo-map
node tools/ogu/cli.mjs graph
```

Read the outputs:
- `.ogu/PROFILE.json`
- `docs/vault/01_Architecture/Repo_Map.md`
- `.ogu/GRAPH.json`

These are your starting points. Everything below enriches them.

## Phase 2: Deep Analysis

Use Glob, Grep, and Read tools to analyze the actual codebase. Do NOT rely only on CLI output.

### Step 2.1: Classify project type

Determine which type this is — it controls which analysis paths to follow:

| Type | Signals |
|------|---------|
| **Web SPA** | Single `src/` or `app/`, React/Vue/Svelte, no backend |
| **Web fullstack** | Frontend + backend dirs, API routes, database config |
| **Monorepo** | `apps/` + `packages/`, workspace config (pnpm-workspace, turbo.json, nx.json) |
| **Mobile** | `ios/`, `android/`, React Native/Expo/Flutter |
| **Web + Mobile** | Both web and mobile apps |
| **API only** | Server code only, no frontend |
| **CLI/Tool** | `bin/`, CLI entry points, no UI |
| **Library** | `src/` with exports, package.json `main`/`exports`, no app |
| **Simple app** | Single entry point, minimal structure |

### Step 2.2: Tech stack deep scan

Read the ACTUAL configuration files, not just check their existence.

**Package dependencies:**
- Read ALL `package.json` files (root + workspaces)
- Extract every dependency and its purpose
- Read custom scripts — they reveal build/test/dev workflows

**Framework configs (read the actual content):**
- `next.config.*` — plugins, redirects, env, image domains
- `vite.config.*` — plugins, aliases, proxy
- `tsconfig.json` — paths, strict mode, target, module
- `tailwind.config.*` — custom theme, plugins, content paths
- `.eslintrc.*`, `prettier.*` — enforced rules
- `docker-compose.yml` — service topology
- `.env.example` — required env vars (NEVER read `.env` — secrets)

**Backend configs:**
- ORM: `prisma/schema.prisma`, `drizzle.config.*`, `knexfile.*` — read the actual schema
- Server: find main server file, read how routes are registered
- Auth: find auth middleware, session config, token generation

**CI/CD:**
- `.github/workflows/*.yml`
- `Dockerfile`, `docker-compose.yml`

### Step 2.3: Code conventions

Read 5-10 representative source files across different areas.

**Naming:**
- Glob for component files → PascalCase? kebab-case?
- Glob for API routes → naming pattern
- Glob for test files → `.test.ts`? `.spec.ts`? `__tests__/`?

**File organization:**
- Components co-located with tests?
- Feature-based folders or type-based folders?
- Styles co-located or separate?
- Types in `.types.ts` or inline?
- Barrel exports (index.ts)?

**Import patterns:**
- Path aliases (`@/`, `~/`, `#`)? Read tsconfig.json paths
- Relative vs absolute?

**Error handling:**
- Grep for `try/catch` patterns
- Search for error boundaries, global handlers, custom error classes

**API patterns:**
- REST? GraphQL? tRPC?
- Frontend API client: fetch, axios, React Query, SWR, tRPC?
- Backend routes: file-based, explicit, decorators?
- Validation: Zod, Joi, Yup, class-validator?

### Step 2.4: Design system detection

**CSS framework:**
- Grep for `@tailwind` in CSS/SCSS files
- Read `tailwind.config.*` fully — extract custom theme values (colors, spacing, fonts, plugins)
- Check for CSS Modules (`.module.css` files)
- Check for styled-components/emotion (`styled.`, `css\``)
- Check for vanilla CSS with custom properties

**Component library:**
- Grep imports from: `@mui/material`, `@chakra-ui`, `@mantine`, `antd`, `@radix-ui`, `@tamagui`
- Check for `components/ui/` directory + `components.json` (shadcn/ui)
- Check for custom component library in `packages/ui/`

**Design tokens:**
- Grep for `:root {` with `--` in CSS files → extract ALL CSS variables
- Read `tailwind.config.*` → extract `theme.extend` (colors, spacing, fonts)
- Search for `tokens.json`, `design.tokens.json`, `theme.ts`, `theme.js`
- Search for `createTheme`, `ThemeProvider` usage

**Icons:**
- Grep for: `lucide-react`, `react-icons`, `@tabler/icons`, `phosphor-react`, `@heroicons`, `@iconify`
- Identify the primary icon set

**Typography:**
- Search for font imports: Google Fonts links, `@font-face`, `next/font`
- Read fonts from Tailwind config or CSS variables

**Colors:**
- Extract the actual palette from CSS variables, Tailwind config, or theme objects
- Identify: primary, secondary, background, surface, text, error, success, warning
- Detect dark mode: `prefers-color-scheme`, `dark:` classes, theme toggle

### Step 2.4b: Brand reference scan (optional)

If the project has a live website (detected from `package.json` `homepage` field, README badges, or `.env.example` with a production URL):

1. Ask the user: "I found a production URL for this project: <url>. Should I scan it for brand DNA (colors, fonts, tone)?"
2. If yes, run:
   ```bash
   node tools/ogu/cli.mjs brand-scan <url> --apply --soul
   ```
3. This populates THEME.json with actual production colors/fonts rather than a preset guess.
4. The scan results are saved to `.ogu/brands/<domain>.json` for reference.

### Step 2.5: Module boundaries

**For monorepos:**
- Read each package's `package.json` to understand its role
- Trace cross-package imports from `.ogu/GRAPH.json`
- Identify leaf packages vs hub packages
- Check for circular dependencies

**For single apps:**
- Identify logical modules (feature folders, domain folders)
- Trace imports between modules
- Identify shared utils vs feature-specific code
- Check for layer violations

### Step 2.6: Auth and authorization

- Search for auth middleware, session management, JWT handling
- Identify provider: NextAuth, Auth.js, Passport, Firebase Auth, Supabase Auth, Clerk, Auth0, custom
- Detect RBAC, permissions, role definitions
- Check for protected routes/pages

### Step 2.7: Data layer

- Read ORM schema files (Prisma, Drizzle, TypeORM, Sequelize)
- Identify all entities/models and their relationships
- Check for migrations directory
- Identify database: PostgreSQL, MySQL, SQLite, MongoDB, Supabase, Firebase
- Check for seeding scripts

### Step 2.8: Testing

- Identify runner: Vitest, Jest, Mocha, Cypress, Playwright
- Count test files (Glob `**/*.test.*` and `**/*.spec.*`)
- Check for test config, utilities, factories, fixtures
- Check for E2E setup

### Step 2.9: README and documentation

- Read `README.md` — extract project purpose, setup, philosophy
- Read `CONTRIBUTING.md`, `ARCHITECTURE.md`, any `docs/` files
- Extract the project's stated goals and principles

## Phase 3: Populate Vault

Using ALL analysis from Phase 2, write each vault file. Replace TODO markers with real content.

### 3.1: `docs/vault/01_Architecture/Default_Stack.md`

Replace template with the ACTUAL detected stack:

```markdown
# Default Stack

Detected from existing codebase. Deviations from this require an ADR.

## Language
**[Detected]** — [where used]

## Frontend
**[Framework]** (v[version])
- Styling: [approach]
- State: [library]
- Validation: [library]

## Backend
**[Framework]** (v[version])
- API style: [REST/GraphQL/tRPC]
- Validation: [library]

## Database
**[DB]** via [ORM]

## Auth
[Detected approach]

## Design System
[Detected library + CSS framework]

## Testing
- Unit: [runner]
- E2E: [runner]

## Package Manager
[detected]

## Structure
[monorepo/single/etc.]
```

### 3.2: `docs/vault/01_Architecture/Invariants.md`

Derive invariants from actual code patterns:

- If TypeScript strict mode → "TypeScript strict mode is enabled. No `any` types without justification."
- If CSS variables only → "No hardcoded colors, spacing, or fonts. Design tokens only."
- If clear layer separation → document the layer rules
- If Zod everywhere → "All API inputs validated with Zod."
- If consistent naming → document as invariant

Keep the template structure but fill with REAL rules. Minimum 5 invariants.

### 3.3: `docs/vault/01_Architecture/Patterns.md`

Fill every section from observed code:

- **Naming Conventions** — actual patterns from component/file/variable names
- **File Organization** — actual directory structure and co-location patterns
- **Config** — how config is loaded (env vars, config files, etc.)
- **API Endpoints** — route definition pattern, validation, response format
- **Error Handling** — actual try/catch patterns, error classes, boundaries
- **Testing** — test file location, naming, assertion patterns
- **Design System** — component usage patterns, token consumption
- **Adding a Module** — inferred from existing module structure

### 3.4: `docs/vault/01_Architecture/Module_Boundaries.md`

Document actual boundaries:

For each module/package/feature-folder:
```
Module: <name>
Responsibility: <what it owns>
Public interface: <what it exports>
Dependencies: <what it imports from>
Must NOT: <observed restrictions>
```

### 3.5: `docs/vault/01_Architecture/Repo_Map.md`

Enrich the CLI output with descriptions:
- What each directory actually contains (from reading files)
- Key files annotated with their purpose
- Service topology from docker-compose
- Build artifacts and locations

### 3.6: `docs/vault/02_Contracts/API_Contracts.md`

If API endpoints exist:
- Document every detected endpoint (method, path, auth)
- Note request/response shapes from code
- Note validation approach

### 3.7: `docs/vault/02_Contracts/Navigation_Contract.md`

If routing exists:
- Document all routes/pages
- Note public vs protected
- Note routing library and pattern

### 3.8: Design tokens

If design tokens detected, write to `docs/vault/02_Contracts/design.tokens.json`:
```json
{
  "version": "1.0.0",
  "colors": { "primary": "...", "background": "...", ... },
  "spacing": { ... },
  "radius": { ... },
  "typography": { "font_body": "...", "font_heading": "...", ... },
  "effects": { ... }
}
```

## Phase 4: Populate Runtime Files

### 4.1: `.ogu/PROFILE.json`

Enrich beyond CLI detection:

```json
{
  "platform": "web",
  "needs_db": true,
  "needs_auth": true,
  "services": ["web", "api", "db"],
  "design_system": "shadcn-ui",
  "css_framework": "tailwind",
  "icon_library": "lucide-react",
  "font_stack": ["Inter", "system-ui"],
  "has_dark_mode": true,
  "test_runner": "vitest",
  "e2e_runner": "playwright",
  "api_style": "rest",
  "orm": "prisma",
  "auth_provider": "next-auth"
}
```

### 4.2: `.ogu/THEME.json`

**If brand-scan was run in Step 2.4b**, THEME.json is already populated from the actual site.
Skip preset matching — the brand scan is more accurate. Proceed to 4.3.

**Otherwise:**

1. If project has design tokens (CSS vars, Tailwind theme), extract them
2. Choose closest mood preset from: cyberpunk, minimal, brutalist, playful, corporate, retro-pixel
   - Dark background → cyberpunk
   - Bright colors + rounded → playful
   - System fonts + minimal → brutalist
   - Blue/gray + professional → corporate
   - Clean white + shadows → minimal
3. Run: `node tools/ogu/cli.mjs theme set <detected-mood>`
4. Override `generated_tokens` in THEME.json with the ACTUAL project tokens

### 4.3: `.ogu/SOUL.md`

From README and docs:
```markdown
# Soul

## Purpose
[From README — what the project does and why]

## Philosophy
[Inferred from code patterns, README, CONTRIBUTING]

## Non-Negotiables
[From strict configs and consistent conventions]
```

### 4.4: `.ogu/USER.md`

Ask the user (one question at a time):

1. "How do you prefer to work with Ogu?"
   - Full Autopilot — I describe the idea, Ogu handles everything
   - Light Guidance — Ogu leads, checks in on key decisions
   - Product Focused — I define the product, Ogu handles tech
   - Deep Collaboration — Ogu asks about everything

2. "What's your role?"
   - Solo developer
   - Tech lead
   - Full-stack developer
   - Frontend / Backend developer

Write answers to USER.md.

### 4.5: `.ogu/MEMORY.md`

Initial facts from analysis:
```markdown
# Memory

- Project uses [framework] v[version] with [key plugins]
- Design system: [library] with tokens in [path]
- Auth: [provider/approach]
- Database: [DB] with [ORM], schema at [path]
- Tests: [runner], [N] test files
- Naming: [pattern] for components, [pattern] for files
- [Key convention 1]
- [Key convention 2]
```

### 4.6: `.ogu/STATE.json`

Update timestamps:
```json
{
  "version": 1,
  "current_task": null,
  "last_context_build": "<now>",
  "last_repo_map_update": "<now>",
  "recent_adrs": [],
  "notes": "Onboarded from existing codebase"
}
```

## Phase 5: Verify

### 5.1: Build and lock context
```bash
node tools/ogu/cli.mjs context
node tools/ogu/cli.mjs context:lock
```

### 5.2: Run doctor
```bash
node tools/ogu/cli.mjs doctor
```
If doctor fails, fix issues and re-run until it passes.

### 5.3: Query global memory
```bash
node tools/ogu/cli.mjs recall
```
Note relevant cross-project patterns.

## Phase 6: Report

### 6.1: Log
```bash
node tools/ogu/cli.mjs log "Onboarded existing project: <name>"
node tools/ogu/cli.mjs remember --apply
```

### 6.2: Present summary

```
Onboarding complete: <project name>

## Project Profile
- Platform: <web/mobile/etc.>
- Stack: <framework> + <backend> + <db>
- Design: <component library> + <CSS framework>
- Auth: <auth approach>
- Tests: <runner> (<N> test files)

## Vault populated
- Invariants.md         <N> rules
- Patterns.md           <N> patterns
- Module_Boundaries.md  <N> modules
- Default_Stack.md      Actual stack
- Repo_Map.md           <N> entries
- API contracts         <N> endpoints
- Navigation contract   <N> routes
- Design tokens         <N> tokens

## Design system
- Library: <detected>
- Colors: primary=<color>, bg=<color>
- Fonts: <stack>
- Icons: <library>
- Dark mode: <yes/no>

## Doctor: HEALTHY

Ready to build. What would you like to work on?
```

## Handling Different Project Types

### Web SPA
Focus on: component patterns, routing, state management, API client
Design system detection is critical

### Fullstack monorepo
Map every app and package. Document data model from ORM schema. Document API endpoints from route handlers

### Mobile (React Native / Expo)
Check for Tamagui/NativeBase/RN Paper. Navigation: React Navigation config. Platform-specific files

### API only
Focus on: routes, middleware, validation, error handling, data model

### Simple app
Keep analysis proportional — don't over-document. Focus on entry point and key deps

### Library/CLI
Focus on: public API surface, exports, versioning. Module boundaries = public vs internal

## Rules

- NEVER skip the deep analysis (Phase 2). CLI commands are just a starting point.
- NEVER invent patterns that don't exist in the code. Every vault entry must trace to actual files.
- NEVER leave TODO markers in vault files after onboarding. If you can't determine something, write "Not detected — to be determined when first feature is built."
- Read at least 5-10 source files across different areas before writing Patterns.md.
- Read the ACTUAL config files, not just check their existence.
- If the project doesn't match the default stack, document what it ACTUALLY uses. Don't force it.
- If conventions contradict Ogu defaults (e.g., uses MUI), document the REAL conventions and note deviations.
- For large codebases (>500 files), focus on: entry points, core modules, shared utils, config files.
- Always ask the user the involvement level question.
- Report in the user's language.
- After onboarding, `ogu doctor` must pass.
