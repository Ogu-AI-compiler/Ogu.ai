---
name: parsing
description: Parsing expertise for low-level systems programming, embedded development, and performance-critical code. Use when implementing parsing, working with hardware interfaces, or optimizing system-level code. Triggers: "parsing", "implement parsing", "systems parsing", "low-level parsing".
---

# Parsing

## When to Use

Activate this skill when:
- Working on parsing tasks
- Reviewing or improving existing parsing implementations
- Troubleshooting issues related to parsing
- Setting up or configuring parsing from scratch

## Workflow

1. Define hardware constraints, timing requirements, and resource limits
2. Design data structures and algorithms for the constrained environment
3. Implement with explicit memory management and error handling
4. Add hardware-specific validation and boundary condition checks
5. Profile: CPU cycles, memory footprint, interrupt latency
6. Test on target hardware with edge-case conditions
7. Test failure modes: power loss, hardware fault injection
8. Document interfaces, timing contracts, and resource usage

## Quality Bar

- Meets timing and resource constraints
- No undefined behavior (validated with sanitizers/static analysis)
- Tested on target hardware
- Failure modes handled safely
- Memory footprint within budget

## Related Skills

See complementary skills in the same domain for additional workflows.
