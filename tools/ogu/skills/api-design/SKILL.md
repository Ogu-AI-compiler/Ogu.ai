---
name: api-design
description: Designs RESTful or GraphQL APIs with consistent naming, versioning, pagination, and error handling conventions. Use when defining new endpoints, writing API contracts, or refactoring existing APIs. Triggers: "design the API", "define endpoints", "API contract", "OpenAPI spec", "REST design".
---

# API Design

## When to Use
- Defining new service endpoints or resources
- Refactoring an inconsistent or poorly designed API
- Writing an OpenAPI spec or API contract for a new service

## Workflow
1. Define resources and their relationships before defining endpoints
2. Use noun-based, plural resource names (`/users`, `/orders/{id}`)
3. Map CRUD operations to HTTP methods (GET/POST/PUT/PATCH/DELETE)
4. Define request/response schemas with all required and optional fields
5. Design consistent error responses: `{ error: { code, message, details } }`
6. Add versioning strategy (`/v1/`, header-based, or content negotiation)

## Quality Bar
- All endpoints follow consistent naming conventions
- Every error response has a machine-readable code, not just a message
- Pagination defined for list endpoints (cursor or offset)
- Breaking changes require version bump and deprecation notice
