---
name: error-handling
description: Designs and implements robust error handling, retry logic, and graceful degradation. Use when adding error handling to APIs, services, or UI components, or when making systems more resilient to partial failures. Triggers: "handle errors", "add error handling", "retry logic", "error boundaries", "graceful degradation".
---

# Error Handling

## When to Use
- Adding error handling to a new service or API endpoint
- Making an existing system more resilient to partial failures
- Designing the error response contract for a service

## Workflow
1. Categorize errors: client errors (4xx, user-fixable) vs server errors (5xx, system failures)
2. Return machine-readable error codes alongside human-readable messages
3. Add retry logic for transient failures (network, rate limits) with exponential backoff
4. Implement circuit breakers for downstream dependencies
5. Log errors with full context (correlation ID, user ID, request parameters)

## Quality Bar
- User-facing errors are actionable: tell the user what went wrong and what to do
- Stack traces never exposed to end users
- Retry logic has a maximum attempt limit and jitter to prevent thundering herd
- All error paths are tested, not just the happy path
