# QA Compiler: visual-regression

## Purpose
Validate that visual regression tests are properly configured with realistic thresholds,
mobile viewport coverage, and an actionable approval workflow.

## Spec File
`visual-regression-spec.json` in the compiler directory.

## Invariants

| Code  | Rule                                                                                |
|-------|-------------------------------------------------------------------------------------|
| QA060 | Spec must have `tool`, `viewports[]`, capture targets, and `diffThreshold`          |
| QA061 | `diffThreshold` must be between 0.001 and 0.05 (0.1%–5%)                           |
| QA062 | At least one mobile viewport (width ≤ 768px) must be declared                      |
| QA063 | `approvalWorkflow` must be declared; `auto-approve-all` is forbidden                |
| QA064 | `storybookBuildDir` required when `stories[]` is non-empty                         |
| QA065 | No TODO/FIXME/HACK in any source file                                               |
| QA066 | `visual-regression-artifact.json` must be structurally valid                       |

## Spec Shape

```json
{
  "project": "my-app",
  "tool": "chromatic",
  "viewports": [
    { "name": "mobile", "width": 375, "height": 812 },
    { "name": "tablet", "width": 768, "height": 1024 },
    { "name": "desktop", "width": 1440, "height": 900 }
  ],
  "diffThreshold": 0.005,
  "stories": ["Button", "Card", "Navigation", "Dashboard"],
  "routes": ["/", "/login", "/dashboard"],
  "storybookBuildDir": "storybook-static",
  "approvalWorkflow": {
    "mode": "pr-comment",
    "notifyOnChange": true
  }
}
```

## diffThreshold Values

| Value  | % Change | Behavior                                         |
|--------|----------|--------------------------------------------------|
| 0      | 0%       | **FORBIDDEN** — fails on any single pixel        |
| 0.001  | 0.1%     | Very tight — good for pixel-perfect UI           |
| 0.005  | 0.5%     | Recommended default                              |
| 0.02   | 2%       | Recommended max for dynamic content              |
| 0.05   | 5%       | Maximum allowed — use only for animated content  |
| > 0.05 | > 5%     | **FORBIDDEN** — too lenient                      |

## Approval Workflow Modes

| Mode                        | Behavior                                           |
|-----------------------------|-----------------------------------------------------|
| `manual`                    | Human reviews and approves in dashboard            |
| `pr-comment`                | Tool posts diff as PR comment, human approves      |
| `chromatic-ui`              | Chromatic's own review interface                   |
| `percy-dashboard`           | Percy's review dashboard                           |
| `auto-approve-non-critical` | Auto-approves small changes, flags large ones      |
| `external`                  | Custom approval system                             |
| `auto-approve-all`          | **FORBIDDEN** — defeats the purpose of VRT         |

## Error Codes

| Code  | Name                         | Fix                                                       |
|-------|------------------------------|-----------------------------------------------------------|
| QA060 | spec-invalid                 | Add `tool`, `viewports[]`, capture targets, `diffThreshold` |
| QA061 | threshold-unrealistic        | Set `diffThreshold` between 0.001 and 0.05               |
| QA062 | no-mobile-viewport           | Add `{ "name": "mobile", "width": 375, "height": 812 }`  |
| QA063 | no-approval-workflow         | Add `approvalWorkflow.mode`                               |
| QA064 | no-storybook-build-dir       | Add `storybookBuildDir: "storybook-static"`               |
| QA065 | todos-found                  | Resolve all TODO/FIXME/HACK                               |
| QA066 | artifact-invalid             | Run runner.mjs to regenerate artifact                     |

## Output Artifact

`visual-regression-artifact.json`

```json
{
  "ir_id": "VISUAL_REGRESSION:my-app",
  "tool": "chromatic",
  "viewports": [ ... ],
  "diffThreshold": 0.005,
  "stories": ["Button", "Card"],
  "routes": ["/", "/dashboard"],
  "approvalWorkflow": { "mode": "pr-comment" },
  "gates": [ { "pass": true, "code": "QA060" } ],
  "pass": true,
  "attestation": { "hash": "<sha256>", "timestamp": "..." }
}
```
