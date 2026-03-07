---
name: testing-backend
description: Writes unit, integration, and contract tests for backend services, APIs, and database operations. Use when testing API endpoints, business logic, data access layers, or service contracts. Triggers: "test this API", "write backend tests", "integration test", "unit test the service", "test the endpoint".
---

# Backend Testing

## When to Use
- Adding tests to new API endpoints or service methods
- Writing integration tests against a real or in-memory database
- Verifying contract compatibility between services

## Workflow
1. Test the public interface, not internal implementation details
2. For unit tests: mock external dependencies (DB, HTTP clients, queues)
3. For integration tests: use a real DB in a container or in-memory equivalent
4. Test the happy path first, then error cases (missing fields, auth failures, not found)
5. Add contract tests for any cross-service API boundary

## Quality Bar
- Test names describe the scenario: "should return 404 when user not found"
- No tests that always pass regardless of implementation
- Integration tests clean up test data after each run
- Coverage of all documented error codes in the API spec
