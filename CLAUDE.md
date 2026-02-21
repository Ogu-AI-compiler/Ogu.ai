# AI Compiler

A compiler pipeline that transforms ideas into fully working, tested applications.

## Philosophy

- **Compiler, not task runner**: Every phase produces verified output for the next phase.
- **Correctness over speed**: Code must pass tests, not just look right.
- **Test-first**: Tests are written before implementation.
- **Spec as contract**: The SPEC.md is law. Code that violates it is rejected.

## Pipeline

```
/idea → IDEA.md (structured, deep understanding of the concept)
/write-prd → PRD.md (full product requirements)
/write-spec → SPEC.md (technical contract: invariants, boundaries, API)
/map-repo → ARCHITECTURE.md (current repo state)
/decompose → TASKS.md (tasks with dependencies)
/build → Implementation (sandboxed to PLAN)
/validate → Tests + enforcement
/preview → Live dev server
```

## Conventions

- All pipeline artifacts are Markdown files in the project root
- Skills live in `.claude/commands/`
- Templates live in `templates/`
- Generated output goes to `output/`
