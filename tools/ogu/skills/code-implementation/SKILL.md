---
name: code-implementation
description: Writes production-quality code from specifications and requirements. Use when implementing new features, functions, classes, APIs, or modules. Triggers: "implement", "write code for", "build this feature", "create the function", "code this up".
---

# Code Implementation

## When to Use
- Implementing new features from a specification or ticket
- Writing functions, classes, or modules from scratch
- Translating pseudocode or requirements into working code

## Workflow
1. Read the specification completely before writing any code
2. Identify edge cases, validation requirements, and error conditions
3. Write code in small, testable units (functions under 50 lines)
4. Add inline comments for non-obvious logic only
5. Review for security issues (input validation, injection, secrets) before finishing

## Quality Bar
- All specified edge cases are handled
- No hardcoded values — use constants or config
- Follows project naming and formatting conventions
- Functions are single-responsibility and testable in isolation
