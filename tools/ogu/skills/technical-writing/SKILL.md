---
name: technical-writing
description: Creates clear, accurate technical documentation including architecture docs, runbooks, guides, and reference material. Use when writing API docs, architecture decisions, onboarding guides, or operational runbooks. Triggers: "write documentation", "document this", "create a guide", "technical writing", "write a runbook".
---

# Technical Writing

## When to Use
- Documenting a new system, API, or feature for engineers or users
- Writing a runbook for operational procedures
- Creating onboarding documentation for a new team member

## Workflow
1. Identify the audience: what do they know already, what do they need to do
2. Structure before writing: title, overview, prerequisites, steps, examples, troubleshooting
3. Use the active voice and imperative mood for instructions ("Run this command")
4. Include working code examples tested against the actual system
5. Review for accuracy with someone who hasn't seen the system before

## Quality Bar
- A new reader can accomplish the goal without asking questions
- Code examples are copy-pasteable and work without modification
- Technical terms are defined on first use or linked to a glossary
- Documentation lives with the code and is updated in the same PR as code changes
