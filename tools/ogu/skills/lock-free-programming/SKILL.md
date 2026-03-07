---
name: lock-free-programming
description: Lock free programming expertise for low-level systems programming, embedded development, and performance-critical code. Use when implementing lock free programming, working with hardware interfaces, or optimizing system-level code. Triggers: "lock free programming", "implement lock-free-programming", "systems lock-free-programming", "low-level lock-free-programming".
---

# Lock free programming

## When to Use

Activate this skill when:
- Working on lock free programming tasks
- Reviewing or improving existing lock free programming implementations
- Troubleshooting issues related to lock free programming
- Setting up or configuring lock free programming from scratch

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
