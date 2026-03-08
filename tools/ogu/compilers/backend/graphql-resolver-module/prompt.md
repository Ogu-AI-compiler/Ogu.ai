# GraphQL Resolver Module Compiler

## Purpose
Compiles GraphQL resolvers with N+1 protection, auth, and proper error mapping.

## Invariants
1. **Service layer** — No direct DB (prisma/knex) in resolvers.
2. **DataLoader** — List/nested resolvers use DataLoader or batch loading.
3. **Auth per resolver** — Protected resolvers check `context.user`.
4. **GraphQLError** — Throw `GraphQLError` not raw `Error`.

## Standard Pattern
```typescript
const resolvers = {
  Query: {
    user: async (_, { id }, context) => {
      if (!context.user) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHORIZED' } });
      return context.loaders.user.load(id); // DataLoader — no N+1
    },
  },
  User: {
    posts: async (user, _, context) => {
      return context.loaders.postsByUser.load(user.id); // batch loaded
    },
  },
};
```

## Error codes
| Code  | Meaning |
|-------|---------|
| GR001 | graphql-resolver-spec.json missing/invalid |
| GR002 | Schema artifact mismatch |
| GR003 | Direct DB call in resolver |
| GR004 | No DataLoader for list resolvers |
| GR005 | Auth check missing on protected resolver |
| GR006 | Raw Error thrown instead of GraphQLError |
| GR007 | TODO/FIXME/HACK |
| GR008 | Tests failed |
| GR009 | Contract violation |
