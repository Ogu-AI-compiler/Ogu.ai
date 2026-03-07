---
name: debugging
description: Systematically identifies and resolves defects using log analysis, profiling, and root cause analysis. Use when tracing errors, investigating unexpected behavior, or diagnosing performance failures. Triggers: "debug", "fix the bug", "why is this failing", "trace the error", "investigate the issue".
---

# Debugging

## When to Use
- An error or exception is occurring in production or development
- Behavior is incorrect but no error is thrown
- Performance is worse than expected without a clear cause

## Workflow
1. Reproduce the issue in the smallest possible context
2. Collect all available signals: logs, stack traces, metrics, recent changes
3. Form a hypothesis about the root cause
4. Test the hypothesis by isolating the suspect code path
5. Fix the root cause (not the symptom); verify fix doesn't break other paths

## Quality Bar
- Root cause is identified, not just the symptom
- Fix is minimal and targeted — no unrelated refactoring during a bug fix
- Regression test added to prevent recurrence
- Postmortem written for production incidents
