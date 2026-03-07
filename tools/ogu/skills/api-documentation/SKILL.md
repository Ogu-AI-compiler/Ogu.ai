---
name: api-documentation
description: Documents REST or GraphQL APIs with OpenAPI specs, code examples, and integration guides. Use when creating API references, writing integration tutorials, or building developer-facing documentation. Triggers: "document the API", "OpenAPI", "API reference", "Swagger", "API docs", "endpoint documentation".
---

# API Documentation

## When to Use
- Writing reference documentation for new API endpoints
- Creating an OpenAPI/Swagger spec for an existing API
- Building a developer portal or integration guide

## Workflow
1. Write the OpenAPI spec as the source of truth (spec-first approach)
2. Include request/response examples for every endpoint
3. Document all error codes with explanations and recovery guidance
4. Add authentication guide at the top level (not buried in endpoint reference)
5. Generate SDK code snippets in 2-3 languages from the spec

## Quality Bar
- Every field in request/response is documented with type, description, and example
- Error codes are machine-readable and map to human-readable explanations
- Authentication is documented with a complete working example
- Docs stay in sync with the API — review in same PR as API changes
