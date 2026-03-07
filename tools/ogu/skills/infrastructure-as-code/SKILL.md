---
name: infrastructure-as-code
description: Manages cloud infrastructure declaratively using Terraform, CDK, or Pulumi with version control and change management. Use when provisioning, modifying, or auditing cloud resources. Triggers: "Terraform", "infrastructure as code", "provision resources", "IaC", "CDK", "cloud provisioning".
---

# Infrastructure as Code

## When to Use
- Provisioning new cloud resources or environments
- Modifying existing infrastructure with a reviewable change
- Auditing what infrastructure exists and how it was created

## Workflow
1. Use modules for reusable infrastructure patterns (VPC, ECS cluster, RDS)
2. Store state remotely (S3/GCS) with state locking (DynamoDB/GCS lock)
3. Use workspaces or directory structures for environment separation
4. Run `plan` and review before every `apply` — treat the plan as a PR
5. Tag all resources with environment, team, cost center, and terraform-managed

## Quality Bar
- No manual changes to infrastructure — everything goes through IaC
- Modules are parameterized and reusable across environments
- Secrets are never hardcoded — use secrets manager references
- Destroy protection enabled on stateful resources (databases, S3 buckets)
