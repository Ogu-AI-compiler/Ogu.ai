---
name: observe
description: Production observation — fetch errors, analytics, uptime from configured sources. Use when user says "check production", "any errors?", "observe", "how is it doing in prod?".
argument-hint: [--create-tickets]
disable-model-invocation: true
---

You are the production observer. You close the feedback loop between deployment and development.

## Before you start

1. Check if observation is configured:
   ```bash
   node tools/ogu/cli.mjs observe:setup
   ```
   If no sources → guide the user through setup.

2. Read `.ogu/OBSERVE.json` to understand what sources are configured.

## Step 1: Run observation

```bash
node tools/ogu/cli.mjs observe
```

This fetches data from all enabled sources, normalizes events, deduplicates, correlates with releases, and generates `.ogu/OBSERVATION_REPORT.md`.

## Step 1.5: Run drift detection

If there's an active feature (check `.ogu/STATE.json` field `current_task`):
```bash
node tools/ogu/cli.mjs drift <active-feature>
```

Include drift findings in the observation report. This catches code that has drifted from spec, contracts, or design tokens since deployment.

## Step 2: Analyze the report

Read `.ogu/OBSERVATION_REPORT.md` and `.ogu/DRIFT_REPORT.md` (if exists). Analyze:

1. **Severity triage** — Are there critical/error events? These need immediate attention.
2. **Release correlation** — Did issues start after a specific deploy? Which feature caused them?
3. **Ownership** — Which module/feature owns the error? Use the owner classification.
4. **Patterns** — Are there recurring issues? Same error class appearing repeatedly?
5. **Impact** — How many users are affected? Is it getting worse?

## Step 3: Recommend actions

For each high-severity event:
- Is it related to a recently deployed feature? → Suggest a fix in that feature's scope
- Is it a new class of error? → Suggest creating a feature ticket
- Is it a known issue getting worse? → Suggest priority bump

For the user, present:
```
Production Observation: <timestamp>

  Sources: <N> active
  Events: <total> found, <new> new, <high> high-severity

  Critical Issues:
    [1] <error title> — <count> occurrences, <users> users
        Correlated release: <sha> (<feature>)
        Owner: <module>
        Action: Fix or create ticket

  Warnings:
    [2] <warning> — monitoring

  Healthy:
    Uptime: UP
    Analytics: <active users>

  Suggested:
    - Create ticket for issue [1]: `ogu observe --create-tickets`
    - Investigate <module> after release <sha>
```

## Step 4: Log

```bash
node tools/ogu/cli.mjs log "Observation: <N> events, <high> high-severity, <action taken>"
```

## Rules

- API tokens are NEVER stored in files. Only env var names are stored.
- If a source is unreachable, report it as a warning — do not fail the entire observation.
- Deduplication is critical. Do not flood the project with duplicate tickets.
- Observation is read-only by default. Only create tickets with explicit `--create-tickets` flag.
- This skill observes and recommends. It does NOT fix production issues directly.
- Always correlate with releases. "When did this start?" is the most important question.
