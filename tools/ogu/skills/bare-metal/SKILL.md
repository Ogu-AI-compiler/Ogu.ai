---
name: bare-metal
description: Bare metal expertise for building robust, scalable backend services and APIs. Use when implementing bare metal, designing APIs, or building server-side features. Triggers: "bare metal", "implement bare metal", "build bare-metal", "backend bare-metal".
---

# Bare metal

## When to Use

Activate this skill when:
- Working on bare metal tasks
- Reviewing or improving existing bare metal implementations
- Troubleshooting issues related to bare metal
- Setting up or configuring bare metal from scratch

## Workflow

1. Define API contract (OpenAPI spec) or data model
2. Implement business logic with clear separation of concerns
3. Add input validation and sanitization at entry points
4. Implement authentication and authorization checks
5. Add structured logging and observability instrumentation
6. Write unit tests for business logic
7. Write integration tests for API endpoints
8. Review for security vulnerabilities (OWASP Top 10)
9. Document API behavior, error codes, and examples

## Quality Bar

- All endpoints return correct HTTP status codes
- Input validation rejects malformed requests with clear errors
- Authentication/authorization enforced on all protected routes
- Performance meets SLO targets (p95 latency)
- No sensitive data leaked in error responses

## Related Skills

See complementary skills in the same domain for additional workflows.
