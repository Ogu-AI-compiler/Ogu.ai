---
name: code-review
description: Reviews code for correctness, security, performance, and maintainability. Use when evaluating pull requests, auditing existing code, or identifying technical debt. Triggers: "review this code", "check my PR", "audit the codebase", "code review", "LGTM?".
---

# Code Review

## When to Use
- A pull request needs review before merging
- Auditing existing code for quality or security issues
- Onboarding review to ensure new engineers follow project conventions

## Workflow
1. Understand the intent: read the PR description and linked ticket first
2. Review for correctness: does the code do what the spec says?
3. Review for security: input validation, auth checks, secrets exposure
4. Review for performance: N+1 queries, unnecessary loops, memory leaks
5. Review for maintainability: naming clarity, complexity, missing tests

## Quality Bar
- Feedback is specific and actionable ("Rename X to Y because Z"), not vague
- Blocking comments cite specific risk (security, correctness, data loss)
- Non-blocking suggestions labeled as NIT or OPTIONAL
- Positive patterns acknowledged, not only problems
