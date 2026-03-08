# QA Compiler: accessibility-policy

## Purpose
Validate that accessibility testing policy uses a current WCAG standard, enforces
violations in CI, defines manual testing checkpoints, and justifies any rule exclusions.

## Spec File
`accessibility-policy-spec.json` in the compiler directory.

## Invariants

| Code  | Rule                                                                                  |
|-------|---------------------------------------------------------------------------------------|
| QA070 | Spec must have `tool`, `wcagLevel`, `wcagVersion`, `ciEnforcement`, `scope`           |
| QA071 | `wcagVersion` must be 2.1 or 2.2 (2.0 outdated); `wcagLevel` must be AA or AAA       |
| QA072 | `ciEnforcement.failOn` must include `"critical"`                                      |
| QA073 | `exclude` ≤ 10 selectors; no broad selectors like `body`, `div`, `main`              |
| QA074 | At least 3 `manualCheckpoints` must be defined                                        |
| QA075 | Every `disabledRules` entry must be an object with `ruleId` and `reason` (≥ 20 chars) |
| QA076 | No TODO/FIXME/HACK in any source file                                                  |
| QA077 | `accessibility-policy-artifact.json` must be structurally valid                       |

## WCAG Levels

| Level | Criteria | Required for               |
|-------|----------|----------------------------|
| A     | 30       | Absolute minimum — blocked |
| AA    | 50       | Legal standard (ADA, EN 301 549, EAA) |
| AAA   | 78       | Highest — not required for all content |

## Automated Tools Coverage

| Tool            | Detects ~% of WCAG | Notes                           |
|-----------------|-------------------|---------------------------------|
| axe-core        | 30–40%            | Most widely used, good accuracy |
| pa11y           | 25–35%            | Good for CI pipelines           |
| lighthouse a11y | 20–30%            | Built into Chrome DevTools      |
| WAVE            | 30–40%            | Good visual output              |

**Manual testing covers the remaining 60–70%**.

## Spec Shape

```json
{
  "project": "my-app",
  "tool": "axe-core",
  "wcagVersion": "2.2",
  "wcagLevel": "AA",
  "ciEnforcement": {
    "failOn": ["critical", "serious"]
  },
  "scope": {
    "routes": ["/", "/login", "/dashboard"],
    "components": ["Button", "Form", "Modal"]
  },
  "manualCheckpoints": [
    { "id": "screen-reader", "description": "Navigate all pages using NVDA (Windows) or VoiceOver (macOS)" },
    { "id": "keyboard-only", "description": "Complete all user flows using keyboard only (Tab, Enter, Space, arrows)" },
    { "id": "zoom-200", "description": "Verify content is readable and not obscured at 200% browser zoom" },
    { "id": "reduced-motion", "description": "Test with prefers-reduced-motion: reduce — animations stop" },
    { "id": "color-only", "description": "Verify no information conveyed by color alone" }
  ],
  "exclude": [".third-party-chat-widget"],
  "disabledRules": [
    {
      "ruleId": "color-contrast",
      "reason": "Third-party Intercom widget — vendor has acknowledged issue, ticket #8821 open",
      "ticket": "https://intercom.com/issues/8821",
      "review": "2025-09-01"
    }
  ]
}
```

## Error Codes

| Code  | Name                         | Fix                                                          |
|-------|------------------------------|--------------------------------------------------------------|
| QA070 | spec-invalid                 | Add `tool`, `wcagLevel`, `wcagVersion`, `ciEnforcement`      |
| QA071 | wcag-outdated                | Upgrade to `wcagVersion: "2.2"` and `wcagLevel: "AA"`        |
| QA072 | no-critical-enforcement      | Add `"critical"` to `ciEnforcement.failOn`                   |
| QA073 | excessive-exclusions         | Reduce `exclude` to ≤ 10 specific selectors                  |
| QA074 | no-manual-checkpoints        | Add ≥ 3 manual testing checkpoints                           |
| QA075 | rules-not-justified          | Each disabled rule needs `ruleId` + `reason` (≥ 20 chars)   |
| QA076 | todos-found                  | Resolve all TODO/FIXME/HACK                                  |
| QA077 | artifact-invalid             | Run runner.mjs to regenerate artifact                        |

## Output Artifact

`accessibility-policy-artifact.json`

```json
{
  "ir_id": "ACCESSIBILITY_POLICY:my-app",
  "tool": "axe-core",
  "wcagVersion": "2.2",
  "wcagLevel": "AA",
  "ciEnforcement": { "failOn": ["critical", "serious"] },
  "manualCheckpoints": [ ... ],
  "disabledRules": [ ... ],
  "gates": [ { "pass": true, "code": "QA070" } ],
  "pass": true,
  "attestation": { "hash": "<sha256>", "timestamp": "..." }
}
```
