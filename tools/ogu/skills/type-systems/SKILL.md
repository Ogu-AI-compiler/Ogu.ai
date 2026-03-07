---
name: type-systems
description: Type systems expertise for low-level systems programming, embedded development, and performance-critical code. Use when implementing type systems, working with hardware interfaces, or optimizing system-level code. Triggers: "type systems", "implement type-systems", "systems type-systems", "low-level type-systems".
---

# Type systems

## When to Use

Activate this skill when:
- Working on type systems tasks
- Reviewing or improving existing type systems implementations
- Troubleshooting issues related to type systems
- Setting up or configuring type systems from scratch

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
