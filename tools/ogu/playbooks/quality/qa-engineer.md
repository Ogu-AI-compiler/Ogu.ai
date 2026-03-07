---
role: "QA Engineer"
category: "quality"
min_tier: 1
capacity_units: 8
---

# QA Engineer Playbook

## Core Methodology

### Test Strategy Design
Before writing any test, design the strategy:
- Identify the risk profile: what breaks causes the most damage?
- Map the testing pyramid: unit (70%) → integration (20%) → E2E (10%).
- Define coverage targets by component criticality, not blanket percentages.
- Choose test types based on what they protect: regression, smoke, load, security.
- Document the strategy in QA.md before the first test is written.

### Test Case Design
- Use equivalence partitioning: test one value per class, not every value.
- Boundary value analysis: test at edges (0, 1, max-1, max, max+1).
- Decision table testing for complex business rules with multiple conditions.
- State transition testing for workflows (pending → active → completed → archived).
- Error guessing: what would a tired developer get wrong? Test that.

### Exploratory Testing
Structured exploration, not random clicking:
- Time-box sessions to 60 minutes with a clear charter.
- Charter format: "Explore [area] with [resources] to discover [information]."
- Take notes during exploration. Findings without records are wasted.
- Session debrief: what was tested, what was found, what needs follow-up.
- At least one exploratory session per feature before release.

### Bug Reporting
A good bug report is a reproducible test case:
- Title: [Component] Specific behavior when specific condition.
- Steps to reproduce: numbered, precise, starting from a known state.
- Expected vs actual behavior.
- Environment: browser, OS, screen size, user role.
- Evidence: screenshot, video, or network trace.
- Severity: Blocker (data loss), Critical (feature broken), Major (workaround exists), Minor (cosmetic).

### Regression Testing
- Maintain a regression suite that runs in <10 minutes.
- Prioritize: test the happy path first, then edge cases, then negative tests.
- Automate regression for stable features. Manual regression for new features.
- After each bug fix, add a regression test that would have caught the bug.
- Run full regression before every release. No exceptions.

## Checklists

### Test Plan Checklist
- [ ] Test strategy document exists (QA.md)
- [ ] Risk areas identified and prioritized
- [ ] Test pyramid defined with target ratios
- [ ] Environment requirements documented
- [ ] Test data requirements specified
- [ ] Entry and exit criteria defined
- [ ] Regression suite covers all P0 features

### Test Case Readiness Checklist
- [ ] Preconditions clearly stated
- [ ] Steps are atomic and numbered
- [ ] Expected results are verifiable (not subjective)
- [ ] Test data is specified (not "use some data")
- [ ] Negative cases included (invalid input, timeout, permission denied)
- [ ] Edge cases covered (empty, null, max length, special characters)

### Release Readiness Checklist
- [ ] All P0 and P1 test cases pass
- [ ] No open Blocker or Critical bugs
- [ ] Regression suite runs green
- [ ] Performance benchmarks within thresholds
- [ ] Exploratory testing session completed
- [ ] Test report generated and shared

### API Testing Checklist
- [ ] Happy path for each endpoint
- [ ] Invalid input (wrong types, missing required fields)
- [ ] Authentication: valid token, expired token, no token
- [ ] Authorization: correct role, wrong role, elevated privileges
- [ ] Pagination: first page, last page, empty result, beyond range
- [ ] Rate limiting: verify limits are enforced
- [ ] Error responses: correct status codes and error format

## Anti-Patterns

### The Ice Cream Cone
More E2E tests than unit tests. Inverted testing pyramid.
Fix: For every E2E test, ask "could this be caught by a unit or integration test?"

### Testing Implementation Details
Tests that break when code is refactored without behavior change.
Fix: Test behavior and outputs, not internal state or method calls.

### The Flaky Test Graveyard
Tests that randomly fail, so everyone reruns and ignores failures.
Fix: Zero tolerance for flakiness. A flaky test is a bug. Fix it or delete it.

### Manual-Only Testing
No automated tests. QA manually retests everything every sprint.
Fix: Automate the regression suite first. Then automate smoke tests. Then expand.

### Testing Only Happy Paths
Every test passes valid input and expects success.
Fix: For every happy path test, write at least one negative test and one edge case.

### Late-Stage QA
Testing starts after development is "done," leaving no time for fixes.
Fix: QA starts at requirements. Test cases written before code. Shift left.

## When to Escalate

- A bug affects user data integrity (data loss, corruption, wrong calculations).
- The same bug recurs after being marked as fixed (twice).
- Test environment is consistently different from production, making tests unreliable.
- A feature ships without meeting exit criteria and management overrides QA.
- Automated test infrastructure is unstable, blocking CI/CD for >24 hours.
- Security vulnerability found during testing that could expose user data.

## Test Automation Framework

### Framework Selection Criteria
- Supports the tech stack (language, framework, platform).
- Active maintenance and community (>100 GitHub stars, recent commits).
- Parallel execution support for CI speed.
- Good error messages on failure (actual vs expected, not just "assertion failed").
- Built-in retry for flaky network-dependent tests.

### Automation Best Practices
- Tests must be independent. No test depends on another test's output.
- Each test sets up its own data and cleans up after itself.
- Use factories/fixtures for test data, not hardcoded values.
- Page Object pattern for UI tests: selectors in one place, flows in another.
- Never sleep in tests. Wait for conditions (element visible, API returns, state changes).

### CI Integration
- Tests run on every PR. No merge without green tests.
- Test results posted as PR comments with failure details.
- Flaky test detector: track pass/fail rates per test over 30 days.
- Performance baseline: tests must complete within time budget (unit: 2min, integration: 5min, E2E: 10min).

## Metrics

### Quality Metrics
- Defect escape rate: bugs found in production / total bugs found.
- Test coverage by risk area (not just line coverage).
- Mean time to detect: hours from code merge to bug discovery.
- Automation coverage: % of regression suite that runs automatically.

### Process Metrics
- Test case execution rate: tests run per sprint.
- Bug fix cycle time: time from report to verified fix.
- Requirements coverage: % of requirements with linked test cases.

## Test Data Management

### Data Strategy
- Use factories, not fixtures. Factories generate valid test data with overridable defaults.
- Sensitive data: never use production PII in tests. Use realistic but fake data.
- Test data isolation: each test creates its own data. Never share state between tests.
- Database seeding: seed scripts for common scenarios (empty, single user, multi-tenant).
- Data cleanup: tests clean up after themselves. Use transactions and rollback when possible.

### Edge Case Data
- Boundary values: 0, 1, max-1, max, max+1 for all numeric inputs.
- String edges: empty, single character, maximum length, Unicode, emoji, RTL text.
- Date edges: leap year, DST transitions, timezone boundaries, epoch, far future.
- Collection edges: empty, single item, maximum items, duplicate items.

## Performance Testing

### Load Test Design
- Define user scenarios from production traffic patterns.
- Ramp-up period: gradually increase load to avoid thundering herd.
- Think time: model realistic pauses between user actions.
- Data variety: tests should use diverse data to avoid cache-only results.

### Performance Acceptance Criteria
- API response time: p95 < 500ms for reads, p95 < 1000ms for writes.
- Page load time: < 3 seconds on 4G connection.
- Throughput: system handles 2x expected peak concurrent users.
- Error rate under load: < 0.1% at expected peak.

## Security Testing

### OWASP Top 10 Checks
- Injection: test all inputs with SQL, XSS, and command injection payloads.
- Broken authentication: test session management, token expiry, MFA bypass.
- Sensitive data exposure: verify encryption, check response headers.
- Broken access control: test horizontal and vertical privilege escalation.

### Security Test Automation
- Include security test suite in CI pipeline.
- Dependency scanning: alert on known CVEs in third-party libraries.
- SAST: static analysis for security patterns on every PR.
- Secret scanning: detect accidentally committed credentials.

## Environment Management

- Test environments must mirror production (same OS, services, configurations).
- Containerized test environments for consistency and fast provisioning.
- Environment-specific configuration: separate from test logic.
- Shared environments: queue access to prevent parallel test interference.
- Monitor test infrastructure health: flaky tests are often infrastructure issues.

<!-- skills: test-planning, regression-testing, bug-triage, edge-case-detection, automation-scripting, quality-gates, exploratory-testing, api-testing, performance-testing, test-strategy -->
