---
name: security-scan-pipeline
description: Compiler skill for the security_scan_pipeline compiler. Activates when producing security-scan-artifact.json. Gates: SS001–SS007. No upstream dependency.
---

# security-scan-pipeline — Compiler Skill

## What This Compiler Does

Compiles the security scan pipeline specification — scanner types, severity thresholds, ignore rules, report output, and coverage requirements. Enforces: all scanner types are recognized, every scanner has a `failOn` severity threshold, no global-ignore overrides, report output has path and format, and the pipeline covers both image scanning and SAST.

**Upstream dependency:** none
**Output artifact:** `security-scan-artifact.json`
**IR identifier:** `SECURITY_SCAN:{project}`

---

## Spec Shape

```json
{
  "name": "api-security-scan",
  "scanners": [
    {
      "type": "trivy",
      "target": "registry.example.com/api:latest",
      "failOn": "critical",
      "ignoreVulns": ["CVE-2023-12345"]
    },
    {
      "type": "semgrep",
      "target": "src/",
      "failOn": "high",
      "rulesets": ["p/owasp-top-ten", "p/nodejs"]
    },
    {
      "type": "checkov",
      "target": "infra/",
      "failOn": "high"
    }
  ],
  "output": {
    "path": "reports/security-scan.sarif",
    "format": "sarif"
  }
}
```

Required fields:
- `name` — pipeline name
- `scanners` — non-empty array, each with `type`

---

## Gates

### SS001 — spec-valid
Reads `security-scan-spec.json`. Required: `name`, `scanners` (non-empty array). Each scanner needs `type`.

Hard-fails if `security-scan-spec.json` is missing.

### SS002 — scanners-known
Every scanner `type` must be from the allowlist: `trivy`, `snyk`, `grype`, `semgrep`, `bandit`, `gosec`, `checkov`, `tfsec`, `kubesec`, `nuclei`, `sonarqube`, `owasp-zap`, `nikto`, `clair`.

BAD:
```json
{ "scanners": [{ "type": "my-custom-scanner" }] }
```
GOOD:
```json
{ "scanners": [{ "type": "trivy" }, { "type": "semgrep" }] }
```

### SS003 — severity-thresholds-set
Every scanner must declare `failOn` with a severity level: `critical`, `high`, `medium`, `low`, `info`.

Without a `failOn` threshold, a scanner finds vulnerabilities but never fails the build — the pipeline is decorative.

BAD:
```json
{ "scanners": [{ "type": "trivy", "target": "myimage:1.0" }] }
// no failOn — scan runs but never blocks
```
GOOD:
```json
{ "scanners": [{ "type": "trivy", "target": "myimage:1.0", "failOn": "critical" }] }
```

### SS004 — no-ignore-all
Global ignore overrides that bypass all findings are blocked:
- `ignoreAll: true`
- `ignoreVulns: ["*"]`
- `globalIgnore: true`

Individual CVE suppressions are allowed. Blanket ignores turn the security scan into a no-op.

BAD:
```json
{ "scanners": [{ "type": "trivy", "ignoreAll": true }] }
{ "scanners": [{ "type": "snyk", "ignoreVulns": ["*"] }] }
```
GOOD:
```json
{ "scanners": [{ "type": "trivy", "ignoreVulns": ["CVE-2023-12345"] }] }
// specific CVE suppression with presumably a documented reason
```

### SS005 — report-output-defined
`spec.output` must be declared with:
- `path` — where to write the report
- `format` — one of: `json`, `sarif`, `junit`, `html`, `table`, `cyclonedx`

Without output, scan results are lost after the pipeline finishes.

BAD:
```json
{ "name": "scan", "scanners": [...] }
// no output config
```
GOOD:
```json
{ "output": { "path": "reports/scan.sarif", "format": "sarif" } }
```

### SS006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### SS007 — contract-scan
Final contract checks:
- At least one image scanner must be present: `trivy`, `grype`, `clair`, `snyk` (escape: `skipImageScan: true`)
- At least one SAST scanner must be present: `semgrep`, `bandit`, `gosec`, `sonarqube` (escape: `skipSAST: true`)

BAD:
```json
{ "scanners": [{ "type": "checkov", "failOn": "high" }] }
// only IaC scan — no image scan, no SAST
```
GOOD:
```json
{ "scanners": [
  { "type": "trivy", "failOn": "critical" },
  { "type": "semgrep", "failOn": "high" },
  { "type": "checkov", "failOn": "high" }
]}
```

---

## What This Compiler Never Forgives

- `security-scan-spec.json` missing (SS001 hard-fails)
- `name` or `scanners` missing (SS001)
- `scanners` empty (SS001)
- Scanner `type` not in allowlist (SS002)
- Any scanner missing `failOn` threshold (SS003)
- `ignoreAll: true` on any scanner (SS004)
- `ignoreVulns: ["*"]` (SS004)
- `globalIgnore: true` (SS004)
- `output` not declared (SS005)
- `output.path` or `output.format` missing (SS005)
- `output.format` not in valid list (SS005)
- No image scanner without `skipImageScan` (SS007)
- No SAST scanner without `skipSAST` (SS007)
