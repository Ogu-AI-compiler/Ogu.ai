---
name: iac-stack-definition
description: Compiler skill for the iac_stack_definition compiler. Activates when producing iac-artifact.json. Gates: IAC001–IAC008. No upstream dependency.
---

# iac-stack-definition — Compiler Skill

## What This Compiler Does

Compiles the Infrastructure-as-Code stack definition — platform, cloud provider, environments, state backend, inputs, outputs, and security checks. Enforces: inputs are declared with type annotations, outputs are declared, no unresolved references, no hardcoded credentials, provider is allowlisted for the target cloud, state backend is declared, and production + staging/dev environments are both present.

**Upstream dependency:** none
**Output artifact:** `iac-artifact.json`
**IR identifier:** `IAC_STACK:{project}`

---

## Spec Shape

```json
{
  "platform": "terraform",
  "cloud": "aws",
  "environments": ["staging", "production"],
  "stateBackend": {
    "type": "s3",
    "bucket": "my-terraform-state",
    "region": "us-east-1",
    "dynamodbTable": "terraform-locks"
  },
  "inputs": [
    { "name": "vpc_cidr", "type": "string", "description": "VPC CIDR block" },
    { "name": "instance_count", "type": "number", "description": "Number of instances" }
  ],
  "outputs": [
    { "name": "alb_dns_name", "description": "Application load balancer DNS" }
  ]
}
```

Required fields:
- `platform` — `terraform`, `pulumi`, `cdk`, `ansible`, or `crossplane`
- `cloud` — `aws`, `gcp`, `azure`, `digitalocean`, `cloudflare`, or `multi`
- `environments` — non-empty array
- `stateBackend` — object

---

## Gates

### IAC001 — spec-valid
Reads `iac-spec.json`. Required: `platform` (valid), `cloud` (valid), `environments` (non-empty), `stateBackend`.

Hard-fails if `iac-spec.json` is missing.

### IAC002 — inputs-declared
**Terraform:** Variable blocks in `.tf` files must have `type` annotations. Variables without types default to `any` — breaking type-safe module interfaces.
**Pulumi/CDK:** `spec.inputs` entries must have `type` field.

BAD (Terraform):
```hcl
variable "db_password" {
  # no type — defaults to any
}
```
GOOD:
```hcl
variable "db_password" {
  type      = string
  sensitive = true
}
```

### IAC003 — outputs-declared
Skipped if no outputs exist. When Terraform `output` blocks are declared in `.tf` files, they must be present. Missing outputs means dependent stacks cannot reference this stack's resources.

### IAC004 — no-unresolved-refs
Template expressions, module references, and data source lookups must not reference undefined variables or non-existent modules.

### IAC005 — no-hardcoded-credentials
Scans `.tf`, `.yaml`, `.ts`, `.py` files for literal credentials:
- AWS access key pattern: `AKIA[0-9A-Z]{16}`
- `password =`, `secret =`, `token =` with literal string values
- API keys that don't use variable/environment references

BAD:
```hcl
provider "aws" {
  access_key = "AKIAIOSFODNN7EXAMPLE"
  secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
}
```
GOOD:
```hcl
provider "aws" {
  # Uses environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
}
```

### IAC006 — provider-allowed
(Terraform only) The provider plugin used must be from the allowlist for the target cloud:
- AWS: `aws`, `awscc`
- GCP: `google`, `google-beta`
- Azure: `azurerm`, `azuread`
- DigitalOcean: `digitalocean`
- Cloudflare: `cloudflare`

BAD:
```hcl
# cloud = "aws" but using google provider
provider "google" { project = "my-project" }
```
GOOD: Provider matches the declared `cloud`.

### IAC007 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### IAC008 — contract-iac
Final contract checks:
- `stateBackend` must be declared (local state is not allowed for team workflows)
- `environments` must include a production environment (by keyword: `production`, `prod`)
- `environments` must include a non-production environment (`staging`, `stage`, `dev`, `development`)
- `spec.inputs` entries must have `description` when typed

BAD:
```json
{ "environments": ["production"], "stateBackend": { "type": "local" } }
// no staging/dev environment; local state backend
```
GOOD:
```json
{
  "environments": ["staging", "production"],
  "stateBackend": { "type": "s3", "bucket": "tf-state-bucket" }
}
```

---

## What This Compiler Never Forgives

- `iac-spec.json` missing (IAC001 hard-fails)
- `platform` not in valid list (IAC001)
- `cloud` not in valid list (IAC001)
- `environments` missing or empty (IAC001)
- `stateBackend` missing (IAC001, IAC008)
- Terraform variables without `type` annotations (IAC002)
- Hardcoded AWS access keys (AKIA pattern) (IAC005)
- `password`/`secret`/`token` with literal values in IaC files (IAC005)
- Provider not matching the declared cloud (IAC006)
- `environments` missing a production environment (IAC008)
- `environments` missing a staging/dev environment (IAC008)
