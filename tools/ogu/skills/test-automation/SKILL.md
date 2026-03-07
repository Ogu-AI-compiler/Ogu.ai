---
name: test-automation
description: Builds and maintains automated test suites that run in CI/CD pipelines to catch regressions reliably. Use when creating test frameworks, writing automation scripts, or improving test reliability and speed. Triggers: "test automation", "automate tests", "CI testing", "automated test suite", "reduce manual testing".
---

# Test Automation

## When to Use
- Building a test automation framework for a new project
- Converting manual test cases to automated tests
- Improving the reliability of an existing flaky test suite

## Workflow
1. Choose the right test level for each scenario: unit > integration > E2E (cost/reliability pyramid)
2. Structure tests with Arrange/Act/Assert; each test has one reason to fail
3. Make tests deterministic: no time dependencies, no shared state between tests
4. Parallelize where possible but guard against resource conflicts
5. Integrate into CI: tests must pass before merge; treat test failures as P1 issues

## Quality Bar
- Test suite runs in under 10 minutes in CI (or fast/slow split)
- Flaky tests are tracked and fixed within the same sprint they appear
- Test coverage is meaningful — critical paths are covered, not just line count
- Tests are maintained alongside the code they test, not as an afterthought
