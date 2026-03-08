# DevOps Engineer Role Decomposition
## Domain Compiler Network — Formal Task Type Specification

> **Scope:** CI/CD · IaC (Terraform/Pulumi/CDK) · Containers · Kubernetes · Helm · Observability · Secrets · Networking · DB Ops · Security · Cost · DR · DX
>
> **Format:** One compiler per atomic task type. Every correctness gate is binary and machine-checkable — no human judgment required.

---

## Summary Table — All 28 Task Types

| # | Compiler ID | Frequency | Input | Output |
|---|---|---|---|---|
| 01 | `dockerfile` | Per-service | App source, runtime spec, base image policy | `Dockerfile`, `.dockerignore` |
| 02 | `compose-config` | Per-service / per-environment | Service graph spec, port map, volume spec | `docker-compose.yml`, override files |
| 03 | `ci-pipeline` | Per-repo / per-workflow-change | Repo type, branch strategy, test/build/deploy spec | `.github/workflows/*.yml` or `.gitlab-ci.yml` |
| 04 | `cd-pipeline` | Per-environment / per-service | Deployment strategy spec, environment matrix, rollback policy | Deploy workflow YAML, environment promotion config |
| 05 | `terraform-module` | Per-resource-type / per-project | Resource spec, cloud provider, variable schema | `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf` |
| 06 | `terraform-state-backend` | Per-project | Cloud provider, state locking requirement, workspace strategy | Backend config `tf`, state bucket/table IaC |
| 07 | `k8s-manifest` | Per-service | Container spec, resource limits, probe spec, service type | `deployment.yaml`, `service.yaml`, `hpa.yaml`, `pdb.yaml` |
| 08 | `helm-chart` | Per-service / per-project | K8s manifest set, values schema, environment matrix | `Chart.yaml`, `values.yaml`, `templates/`, `values-*.yaml` |
| 09 | `kustomize-overlay` | Per-environment | Base k8s manifests, environment delta spec | `kustomization.yaml`, patch files per environment |
| 10 | `ingress-config` | Per-service | Domain spec, TLS policy, routing rules, rate-limit policy | Ingress/Gateway YAML, cert-manager `Certificate` resource |
| 11 | `network-policy` | Per-namespace / per-service | Traffic flow spec (allowed ingress/egress), zero-trust policy | `NetworkPolicy` YAML per service |
| 12 | `secret-schema` | Per-service | Secret name list, rotation policy, source (Vault/SSM/K8s) | Vault policy HCL, `ExternalSecret` YAML, secret schema doc |
| 13 | `prometheus-rules` | Per-service / per-SLO | SLO spec, error budget, alert thresholds, runbook URLs | `PrometheusRule` YAML (recording + alerting rules) |
| 14 | `grafana-dashboard` | Per-service / per-SLO | Metric spec, panel layout spec, variable spec | `dashboard.json`, `datasource.yaml` |
| 15 | `log-pipeline` | Per-service | Log format spec, retention policy, sink config | Fluent Bit / Vector config, log filter rules, index template |
| 16 | `tracing-config` | Per-service | Sampling policy, exporter target, span attribute spec | OTel collector config YAML, SDK init snippet |
| 17 | `db-backup-config` | Per-database | DB type, RTO/RPO spec, storage target, retention policy | Backup CronJob YAML, restore runbook, verification job |
| 18 | `db-connection-pool` | Per-database / per-service | DB spec, max connections, pool sizing formula | PgBouncer/RDS Proxy config, connection limit migration |
| 19 | `migration-runner` | Per-environment | Migration files, rollback spec, lock strategy | Migration job YAML, pre-deploy hook config, lock table migration |
| 20 | `security-scan-config` | Per-repo / per-pipeline | Scan policy (SAST/DAST/SCA), severity thresholds, ignore rules | Trivy/Snyk/Semgrep config files, CI gate config |
| 21 | `resource-tagging` | Per-project / per-account | Tag taxonomy spec, mandatory tag list, cost allocation map | Tagging policy IaC, tag enforcement config, AWS Config rule |
| 22 | `cost-budget-alert` | Per-project / per-account | Monthly budget, per-service allocation, alert thresholds | Budget resource IaC, alert YAML, cost anomaly detector |
| 23 | `dr-runbook` | Per-service / per-project | RTO/RPO spec, failure mode catalog, recovery steps | `runbook.md` (machine-parseable), verification test script |
| 24 | `backup-verification` | Per-backup-config | Backup job output, restore target spec, data integrity checks | Restore test CronJob, verification script, result schema |
| 25 | `dev-environment` | Per-repo / per-stack-change | Service graph, local port map, hot-reload spec | `devcontainer.json` or `Tiltfile` / `Skaffold.yaml`, `Makefile` |
| 26 | `local-k8s-config` | Per-project | Service graph, local infra deps (DB, Redis, queues) | `kind`/`k3d` cluster config, local Helm values override |
| 27 | `dns-record-set` | Per-domain / per-environment | Domain spec, record types, TTL policy, health check routing | Terraform DNS records, Route53/Cloudflare IaC |
| 28 | `cdn-config` | Per-static-asset / per-API-gateway | Origin spec, cache policy, WAF rules, geo-restriction | CDN distribution IaC (CloudFront/Fastly), cache rule set |

---

## Detailed Task Breakdowns

---

### 01 · `dockerfile` — Per-service

**Name:** Dockerfile Compiler

| Field | Detail |
|---|---|
| **Input** | Application source language and runtime version, base image policy (approved registry, distroless/alpine requirement), build tool spec (multi-stage or single), exposed port list, non-root user requirement, health check command, environment variable list (non-secret). |
| **Output** | `Dockerfile` (multi-stage where applicable), `.dockerignore`, optional `docker-bake.hcl` for matrix builds. |
| **Correctness gates** | (1) `hadolint Dockerfile` exits 0 with zero warnings at DL3 level or above. (2) Final image runs as non-root — `docker inspect --format='{{.Config.User}}'` returns non-empty, non-root UID. (3) No secrets in any layer — `docker history --no-trunc` piped through `trufflehog` returns zero findings. (4) Image size ≤ spec'd budget — `docker image inspect` `.Size` field checked against threshold. (5) `HEALTHCHECK` instruction present and returns exit 0 on a running container within 30s. (6) All `COPY` sources exist in `.dockerignore`-filtered context — build fails if a `COPY` references a path excluded by `.dockerignore`. (7) Base image tag is pinned to a digest (`sha256:`), not a mutable tag. |
| **Dependencies** | None (first-order primitive). |
| **Downstream consumers** | `compose-config`, `k8s-manifest`, `ci-pipeline` (build step), `security-scan-config` (image scan target). |

---

### 02 · `compose-config` — Per-service / per-environment

**Name:** Docker Compose Config Compiler

| Field | Detail |
|---|---|
| **Input** | Service graph (which services + their dependencies), port mapping spec, volume spec (named volumes vs. bind mounts), environment variable list (non-secret values only), health check dependency ordering (`depends_on` conditions), network isolation spec. |
| **Output** | `docker-compose.yml` (base), `docker-compose.override.yml` (dev overrides), `docker-compose.ci.yml` (CI-specific: no volume mounts, fixed ports). |
| **Correctness gates** | (1) `docker compose config` exits 0 (valid YAML, all references resolved). (2) All service images reference either a locally-built context or a pinned digest. (3) No host port conflicts — all `ports` entries use unique host ports across all services, verified by extracting all left-side port values and asserting no duplicates. (4) All `depends_on` conditions are `service_healthy`, not `service_started` — grep assertion. (5) No plaintext secrets in `environment` blocks — `trufflehog` scan on file. (6) `docker compose up --wait` completes within 120s in CI (measured). (7) Named volumes listed under top-level `volumes:` key — `docker compose config --format json \| jq '.volumes'` non-null for every referenced volume name. |
| **Dependencies** | `dockerfile` (for services with local build context). |
| **Downstream consumers** | `dev-environment`, `ci-pipeline` (test stage), `integration-test-suite`. |

---

### 03 · `ci-pipeline` — Per-repo / per-workflow-change

**Name:** CI Pipeline Compiler

| Field | Detail |
|---|---|
| **Input** | Repository type (monorepo/polyrepo), language/runtime matrix, branch strategy (trunk-based / gitflow), required checks (lint, type-check, unit test, integration test, security scan, build), artifact publishing spec (registry, tag strategy), parallelism budget (max concurrent jobs). |
| **Output** | `.github/workflows/ci.yml` (or `.gitlab-ci.yml` / `Jenkinsfile`), reusable workflow files (`.github/workflows/reusable-*.yml`), test result artifact upload config. |
| **Correctness gates** | (1) Workflow file passes schema validation — `actionlint` (GitHub Actions) or `gitlab-ci-lint` API returns zero errors. (2) All secrets referenced as `${{ secrets.NAME }}` exist in the repository/org — cross-referenced against a secrets manifest file (not the actual values). (3) No job `runs-on: self-hosted` without an explicit runner label — prevents routing to wrong pool. (4) All jobs have an explicit `timeout-minutes` set ≤ 60. (5) No `continue-on-error: true` on security scan jobs — grep assertion. (6) Cache keys include a hash of the lockfile (`hashFiles('**/package-lock.json')`) — grep assertion. (7) Workflow triggers include `pull_request` targeting the default branch — ensures CI runs on every PR. |
| **Dependencies** | `dockerfile` (build step references it), `security-scan-config` (scan step references scan config). |
| **Downstream consumers** | `cd-pipeline` (CD triggers on CI success), `security-scan-config` (CI invokes scans). |

---

### 04 · `cd-pipeline` — Per-environment / per-service

**Name:** CD Pipeline Compiler

| Field | Detail |
|---|---|
| **Input** | Deployment strategy spec (rolling / blue-green / canary, percentages, bake time), environment promotion matrix (dev → staging → prod), rollback policy (automatic on error rate spike, manual approval gates), notification targets (Slack, PagerDuty), deploy success criteria (health check URL, error rate threshold post-deploy). |
| **Output** | `.github/workflows/deploy-*.yml` (one per environment), environment protection rules config, deployment manifest (ArgoCD `Application` YAML or Flux `Kustomization`). |
| **Correctness gates** | (1) Production deployment job requires `environment: production` with a required reviewer — enforced by checking `environment:` key and repo protection rules via GitHub API. (2) Rollback job exists and references the previous image digest (not `latest`). (3) Post-deploy smoke test step present — asserts HTTP 200 from `/health` endpoint within 60s. (4) Blue-green: traffic shift steps are atomic percentages summing to 100. (5) Canary: bake time ≥ spec'd minimum before full promotion — `sleep` or wait step duration asserted. (6) No deployment directly to production from a non-protected branch — branch filter on deploy job asserted by `actionlint` rule. |
| **Dependencies** | `ci-pipeline` (deploy triggers on CI pass), `k8s-manifest` or `helm-chart` (deploy target), `prometheus-rules` (rollback trigger uses error rate alert). |
| **Downstream consumers** | `dr-runbook` (rollback procedure referenced), `cost-budget-alert` (new deployments may change cost). |

---

### 05 · `terraform-module` — Per-resource-type / per-project

**Name:** Terraform Module Compiler

| Field | Detail |
|---|---|
| **Input** | Resource spec (cloud provider, resource type, configuration parameters), variable schema (name, type, validation rules, defaults), output spec (which attributes to expose), tagging policy (from `resource-tagging` compiler), provider version constraints. |
| **Output** | `main.tf`, `variables.tf` (with `validation {}` blocks), `outputs.tf`, `versions.tf` (provider + terraform version constraints), `README.md` (auto-generated from variable/output schema). |
| **Correctness gates** | (1) `terraform validate` exits 0. (2) `terraform fmt -check` exits 0 (canonical formatting). (3) `tflint --format=json` returns zero errors at `ERROR` severity. (4) All variables without defaults have a `description` — parsed from `variables.tf` AST, zero violations. (5) All resources include mandatory tags defined in `resource-tagging` spec — `tfsec` custom check or `conftest` OPA policy exits 0. (6) `terraform-docs` generated README matches committed README — diff is empty in CI. (7) No hardcoded account IDs, regions, or ARNs — `grep -rP '\d{12}'` on tf files returns 0 matches. |
| **Dependencies** | `terraform-state-backend` (backend must exist before `plan`/`apply`), `resource-tagging` (tag policy used in variable defaults). |
| **Downstream consumers** | `k8s-manifest` (EKS/GKE cluster outputs used), `dns-record-set`, `cdn-config`, `db-backup-config`, `secret-schema`. |

---

### 06 · `terraform-state-backend` — Per-project

**Name:** Terraform State Backend Compiler

| Field | Detail |
|---|---|
| **Input** | Cloud provider, project name, workspace strategy (per-environment workspaces vs. separate state files), state locking requirement (DynamoDB / GCS native locking), encryption requirement (KMS key spec), access control spec (who can read/write state). |
| **Output** | `backend.tf` (backend configuration block), bootstrap IaC (S3 bucket + DynamoDB table, or GCS bucket) as a self-contained Terraform root module, IAM policy for state access. |
| **Correctness gates** | (1) State bucket has versioning enabled — `aws s3api get-bucket-versioning` returns `Enabled`. (2) State bucket blocks all public access — `aws s3api get-public-access-block` all four fields `true`. (3) DynamoDB table (for locking) has `LockID` as the hash key — `describe-table` assertion. (4) Backend config specifies `encrypt = true`. (5) Bootstrap module itself uses a local backend (bootstraps without remote state chicken-and-egg). (6) IAM policy uses least-privilege — only `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:DeleteItem` granted. |
| **Dependencies** | None. This is the foundational IaC primitive. |
| **Downstream consumers** | `terraform-module` (all modules use this backend). |

---

### 07 · `k8s-manifest` — Per-service

**Name:** Kubernetes Manifest Compiler

| Field | Detail |
|---|---|
| **Input** | Container image reference (from `dockerfile` + registry), resource request/limit spec (CPU, memory), probe spec (liveness: command/HTTP/TCP + thresholds, readiness, startup), replica count + HPA spec (min/max, target CPU/memory), service type (ClusterIP/NodePort/LoadBalancer), PodDisruptionBudget spec, security context spec (runAsNonRoot, readOnlyRootFilesystem, capabilities). |
| **Output** | `deployment.yaml`, `service.yaml`, `hpa.yaml`, `pdb.yaml`, `serviceaccount.yaml`, optional `configmap.yaml`. |
| **Correctness gates** | (1) `kubectl --dry-run=client -f .` exits 0 for all files. (2) `kubeconform -strict` exits 0 against target K8s version schema. (3) `kube-score score` exits 0 at critical level — covers resource limits, probes, security context, PDB. (4) All containers set `securityContext.runAsNonRoot: true` and `readOnlyRootFilesystem: true` — `conftest` OPA policy. (5) Resource requests are set (not zero) on every container — grep `resources: {}` returns 0. (6) HPA `minReplicas ≥ 2` for production workloads — spec'd threshold enforced by `conftest`. (7) PDB `maxUnavailable` does not allow all replicas down simultaneously — `minAvailable ≥ 1` or `maxUnavailable < 100%` assertion. |
| **Dependencies** | `dockerfile` (image reference), `secret-schema` (secret volume mounts reference Vault/K8s secrets). |
| **Downstream consumers** | `helm-chart`, `kustomize-overlay`, `ingress-config`, `network-policy`, `cd-pipeline`. |

---

### 08 · `helm-chart` — Per-service / per-project

**Name:** Helm Chart Compiler

| Field | Detail |
|---|---|
| **Input** | K8s manifest set (from `k8s-manifest`), values schema (all configurable parameters + types + defaults), environment matrix (dev/staging/prod values overrides), chart dependency list (subcharts), chart version strategy (semver). |
| **Output** | `Chart.yaml`, `values.yaml` (with JSON schema validation: `values.schema.json`), `templates/` (templated versions of all manifests), `values-dev.yaml`, `values-staging.yaml`, `values-prod.yaml`, `charts/` (packaged dependencies). |
| **Correctness gates** | (1) `helm lint --strict` exits 0. (2) `helm template . -f values-prod.yaml \| kubeconform -strict` exits 0. (3) `values.schema.json` validates `values.yaml` — `helm lint` enforces schema. (4) All secrets referenced in templates as `secretKeyRef`, never as plain values — grep on rendered templates. (5) `helm template` produces identical output on two consecutive runs (deterministic) — diff of two renders is empty. (6) Chart version in `Chart.yaml` follows semver and is incremented from previous release — CI script compares against last git tag. (7) All image tags in default `values.yaml` reference digests, not mutable tags. |
| **Dependencies** | `k8s-manifest` (templates derived from manifests), `secret-schema` (secret references). |
| **Downstream consumers** | `kustomize-overlay` (alternative), `cd-pipeline` (deploys via Helm), `local-k8s-config`. |

---

### 09 · `kustomize-overlay` — Per-environment

**Name:** Kustomize Overlay Compiler

| Field | Detail |
|---|---|
| **Input** | Base k8s manifests directory, environment delta spec (image tag override, replica count override, resource limit overrides, config patches), namespace target per environment, label/annotation additions. |
| **Output** | `base/kustomization.yaml`, `overlays/dev/kustomization.yaml`, `overlays/staging/kustomization.yaml`, `overlays/prod/kustomization.yaml`, patch files under each overlay. |
| **Correctness gates** | (1) `kustomize build overlays/prod \| kubeconform -strict` exits 0. (2) `kustomize build` output is deterministic — two consecutive builds produce identical YAML (diff empty). (3) Production overlay sets resource limits higher than staging — numeric comparison via `yq` on built manifests. (4) No base manifest is modified directly — all changes are patches in overlays (git diff on `base/` between builds is empty). (5) All image overrides reference digests — grep on `kustomize build` output for `:latest` returns 0. (6) Namespace is set per overlay and differs between environments — `yq` assertion on built manifest `metadata.namespace`. |
| **Dependencies** | `k8s-manifest` (base manifests). |
| **Downstream consumers** | `cd-pipeline` (ArgoCD/Flux points to overlay), `local-k8s-config`. |

---

### 10 · `ingress-config` — Per-service

**Name:** Ingress / Gateway Config Compiler

| Field | Detail |
|---|---|
| **Input** | Domain spec (FQDNs per environment), TLS policy (cert-manager issuer, min TLS version), routing rules (path → service:port), rate limit policy (requests/minute per IP), CORS policy, redirect rules (HTTP→HTTPS, www→apex). |
| **Output** | `ingress.yaml` (or `HTTPRoute.yaml` for Gateway API), `certificate.yaml` (cert-manager `Certificate` resource), `middleware.yaml` (Traefik) or `annotation` block. |
| **Correctness gates** | (1) `kubeconform -strict` exits 0. (2) TLS secret name matches `Certificate` resource `secretName` — cross-reference between `ingress.yaml` and `certificate.yaml`. (3) HTTP→HTTPS redirect present — annotation or middleware rule asserted by grep. (4) `minTLSVersion: VersionTLS12` (or higher) set — grep assertion. (5) All referenced backend services exist in the same namespace — cross-reference with `k8s-manifest` service names. (6) Rate limit annotation/middleware present if spec requires — grep assertion. (7) No wildcard `*` in `rules[].host` for production — grep on prod overlay. |
| **Dependencies** | `k8s-manifest` (backend service must exist), `dns-record-set` (domain must be delegated), `secret-schema` (TLS secret managed by cert-manager). |
| **Downstream consumers** | `cdn-config` (CDN origin may be the ingress), `network-policy`, `prometheus-rules` (ingress error rate alert). |

---

### 11 · `network-policy` — Per-namespace / per-service

**Name:** Network Policy Compiler

| Field | Detail |
|---|---|
| **Input** | Traffic flow spec (which services can talk to which), zero-trust default (default-deny-all), egress allow list (external domains/IPs), namespace isolation requirements, DNS egress allowance. |
| **Output** | `default-deny-all.yaml` (namespace-level deny), `allow-*.yaml` (one per permitted flow), per-service `NetworkPolicy` YAML. |
| **Correctness gates** | (1) `kubeconform -strict` exits 0 for all files. (2) Default-deny policy exists in every namespace — grep for `policyTypes: [Ingress, Egress]` with empty `ingress`/`egress` fields. (3) DNS egress (port 53 UDP/TCP to `kube-dns`) is explicitly allowed — grep on egress rules. (4) `conftest` OPA policy: no policy allows `0.0.0.0/0` on port 5432 (DB port) from non-DB namespaces. (5) Every service that accepts traffic has a corresponding ingress allow policy — cross-reference service list against NetworkPolicy `podSelector` labels. (6) No policy uses `{}` (allow-all) selector without explicit justification comment. |
| **Dependencies** | `k8s-manifest` (pod labels used in selectors). |
| **Downstream consumers** | `ingress-config` (ingress controller needs allow policy), `db-connection-pool` (DB network policy). |

---

### 12 · `secret-schema` — Per-service

**Name:** Secret Schema Compiler

| Field | Detail |
|---|---|
| **Input** | Secret name list (key names, types, rotation period), secret source (HashiCorp Vault path / AWS SSM / K8s Secret), access control spec (which service accounts can read which secrets), rotation policy (manual / automated, rotation window), sealed vs. external secret strategy. |
| **Output** | Vault policy file (`.hcl`), `ExternalSecret.yaml` (External Secrets Operator), or `SealedSecret.yaml`, secret reference doc (`secrets-manifest.md` listing all keys without values). |
| **Correctness gates** | (1) Vault policy `vault policy fmt` exits 0 (canonical format). (2) No secret values in any committed file — `trufflehog filesystem .` returns 0 findings. (3) `ExternalSecret` references valid Vault path format — regex: `^secret/data/[a-z0-9-]+/[a-z0-9-]+$`. (4) Secret rotation period ≤ policy maximum — numeric comparison from spec. (5) Every secret referenced in `k8s-manifest` (`secretKeyRef`) has a corresponding entry in the secret schema — cross-reference check. (6) Service account in `ExternalSecret` matches the service account in `k8s-manifest` — name comparison. |
| **Dependencies** | `k8s-manifest` (secret references in pod specs), `terraform-module` (Vault cluster provisioned by Terraform). |
| **Downstream consumers** | `helm-chart` (secret references in templates), `ingress-config` (TLS secrets), `db-connection-pool` (DB credentials). |

---

### 13 · `prometheus-rules` — Per-service / per-SLO

**Name:** Prometheus Rules Compiler

| Field | Detail |
|---|---|
| **Input** | SLO spec (availability target %, latency target p99, error budget window), metric name list (must exist in Prometheus), alert thresholds (warning / critical levels), runbook URLs per alert, inhibition rules (suppress child alerts when parent fires), recording rule spec (expensive queries to pre-compute). |
| **Output** | `prometheusrule.yaml` (CRD, contains both `groups[].rules` for recording and alerting), runbook URL stubs. |
| **Correctness gates** | (1) `promtool check rules prometheusrule.yaml` exits 0. (2) All alert rules have `labels.severity` ∈ `{warning, critical}` — checked by `promtool` + grep. (3) All alert rules have `annotations.runbook_url` — grep assertion on YAML. (4) All metric names referenced in rules exist in the Prometheus target's `/api/v1/label/__name__/values` response — checked against a metric registry snapshot. (5) Recording rule names follow convention `job:metric:aggregation` — regex assertion. (6) Error budget burn rate alert uses multi-window multi-burn-rate spec (1h + 6h windows) per Google SRE Book — structural check on rule conditions. (7) No alert has `for: 0s` (instant alert) without justification comment. |
| **Dependencies** | `k8s-manifest` (service must expose `/metrics`), `grafana-dashboard` (alert links to dashboard). |
| **Downstream consumers** | `grafana-dashboard` (alert panels), `cd-pipeline` (rollback trigger), `dr-runbook` (alert fires → runbook linked). |

---

### 14 · `grafana-dashboard` — Per-service / per-SLO

**Name:** Grafana Dashboard Compiler

| Field | Detail |
|---|---|
| **Input** | Metric spec (metric names, label cardinality, aggregation needed), panel layout spec (row structure, panel types: graph/stat/table/heatmap), variable spec (datasource, environment, service), SLO targets (for threshold lines), refresh interval. |
| **Output** | `dashboard.json` (Grafana dashboard model, version-controlled), `datasource.yaml` (Grafana datasource provisioning config). |
| **Correctness gates** | (1) `dashboard.json` is valid JSON — `jq . dashboard.json` exits 0. (2) Dashboard `uid` is unique within the Grafana org — checked against a registry of existing UIDs. (3) All panel targets reference metrics that exist in the metric registry snapshot — same check as rule 4 in `prometheus-rules`. (4) `schemaVersion` ≥ 36 (current stable) — `jq '.schemaVersion'` assertion. (5) No hardcoded datasource UUIDs — all panels use `${datasource}` variable — `jq '[.. \| objects \| select(.datasource?) \| .datasource \| type == "string"]'` returns empty. (6) Dashboard is importable without errors — Grafana HTTP API `POST /api/dashboards/import` with `overwrite: false` returns 200. |
| **Dependencies** | `prometheus-rules` (alerts referenced in dashboard annotation panels). |
| **Downstream consumers** | `dr-runbook` (links to dashboards), `cd-pipeline` (deploy annotations pushed to Grafana). |

---

### 15 · `log-pipeline` — Per-service

**Name:** Log Pipeline Compiler

| Field | Detail |
|---|---|
| **Input** | Log format spec (JSON structured fields, multiline pattern if applicable), retention policy (hot/warm/cold days per environment), sink config (Elasticsearch / Loki / CloudWatch), PII field list (fields requiring redaction), log volume estimate (lines/second), index/stream naming convention. |
| **Output** | Fluent Bit `fluent-bit.conf` + `parsers.conf` (or Vector `config.toml`), index template JSON (Elasticsearch) or stream config (Loki), retention policy IaC. |
| **Correctness gates** | (1) Fluent Bit config validates — `fluent-bit --dry-run -c fluent-bit.conf` exits 0. (2) PII fields are redacted before forwarding — test log line containing PII field value sent through pipeline; sink receives `[REDACTED]` not original value. (3) Multiline parser correctly merges Java/Python stack traces — test fixture with 10-line stack trace produces 1 output record. (4) Retention policy set per environment — `dev ≤ 7d`, `staging ≤ 30d`, `prod ≥ 90d` (configurable thresholds). (5) Back-pressure handling configured (buffer limits set) — `Mem_Buf_Limit` or equivalent present in config. (6) Index template mapping has `dynamic: strict` — prevents uncontrolled field explosion. |
| **Dependencies** | `k8s-manifest` (log collector runs as DaemonSet), `secret-schema` (sink credentials), `terraform-module` (log storage provisioned). |
| **Downstream consumers** | `prometheus-rules` (log-based metrics via Loki `LogQL`), `dr-runbook` (logs referenced in investigation steps). |

---

### 16 · `tracing-config` — Per-service

**Name:** Distributed Tracing Config Compiler

| Field | Detail |
|---|---|
| **Input** | Sampling policy (head-based rate, tail-based rules: always-sample on error/slow spans), OTel exporter target (Jaeger / Tempo / OTLP endpoint), span attribute spec (mandatory attributes: `service.name`, `service.version`, `deployment.environment`), propagation format (W3C TraceContext / B3). |
| **Output** | `otel-collector.yaml` (OTel Collector deployment config), SDK initialisation snippet (`tracing.ts` / `tracing.py`), `servicegraph` config (if using Tempo). |
| **Correctness gates** | (1) OTel Collector config validates — `otelcol validate --config=otel-collector.yaml` exits 0. (2) Sampling rate ≤ 100% and > 0% — numeric bounds check on config value. (3) All mandatory span attributes present in SDK init snippet — grep for each required attribute key. (4) Propagation format matches ingress/gateway config — cross-reference with `ingress-config` propagation headers. (5) Collector pipeline has a batch processor configured (prevents per-span export) — grep for `batch:` in pipeline config. (6) Exporter endpoint sourced from env var, not hardcoded — grep assertion. |
| **Dependencies** | `k8s-manifest` (collector runs as sidecar or deployment), `secret-schema` (exporter auth), `env-config` (endpoint URLs). |
| **Downstream consumers** | `grafana-dashboard` (trace-to-metrics panels), `prometheus-rules` (span-based SLOs). |

---

### 17 · `db-backup-config` — Per-database

**Name:** Database Backup Config Compiler

| Field | Detail |
|---|---|
| **Input** | Database type (PostgreSQL/MySQL/MongoDB), RTO (max restore time), RPO (max data loss window), storage target (S3 bucket, GCS), retention policy (daily/weekly/monthly counts), encryption requirement (KMS key), notification target on failure. |
| **Output** | Backup `CronJob.yaml` (K8s), restore `Job.yaml` template, backup verification `CronJob.yaml`, `backup-policy.md` (machine-parseable: RPO, RTO, retention values as front-matter). |
| **Correctness gates** | (1) Cron expression fires at frequency ≤ RPO — parsed cron interval vs. RPO value assertion. (2) Backup job uses `pg_dump --format=custom` (not plain SQL) for PostgreSQL — grep assertion. (3) Backup encrypted before upload — `--encrypt` flag or KMS reference present in job command. (4) Job has `failedJobsHistoryLimit: 3` and `successfulJobsHistoryLimit: 3` set. (5) Restore job performs a `pg_restore --list` checksum before full restore — grep assertion. (6) Backup verification CronJob fires within 24h of backup — cron comparison. (7) Failure notification (PagerDuty/Slack webhook) configured in job's `onFailure` hook. |
| **Dependencies** | `terraform-module` (backup S3 bucket), `secret-schema` (DB credentials, KMS key ref), `k8s-manifest` (CronJob base). |
| **Downstream consumers** | `backup-verification`, `dr-runbook`. |

---

### 18 · `db-connection-pool` — Per-database / per-service

**Name:** Database Connection Pool Compiler

| Field | Detail |
|---|---|
| **Input** | Database spec (max_connections from PostgreSQL config), service count and replica count, concurrency profile per service (max concurrent queries), pool mode (transaction / session), statement timeout, idle timeout. |
| **Output** | `pgbouncer.ini` + `userlist.txt` (or RDS Proxy Terraform config), connection limit migration (`ALTER ROLE ... CONNECTION LIMIT`), pool sizing documentation. |
| **Correctness gates** | (1) Sum of all pool `max_client_conn` values ≤ PostgreSQL `max_connections - 5` (reserved for admin) — numeric assertion from config files. (2) `pool_mode = transaction` for stateless services — grep assertion. (3) `server_idle_timeout` set (not 0, prevents leaked connections) — numeric check > 0. (4) `userlist.txt` contains no plaintext passwords — all entries use MD5 hash format `md5<hash>` — regex assertion. (5) `pgbouncer.ini` validates — `pgbouncer --check-config pgbouncer.ini` exits 0. (6) Statement timeout ≤ application-level timeout — cross-reference with `env-config` query timeout value. |
| **Dependencies** | `secret-schema` (DB credentials), `terraform-module` (DB instance provisioned), `network-policy` (PgBouncer needs DB ingress rule). |
| **Downstream consumers** | `k8s-manifest` (services connect via pool), `prometheus-rules` (pool saturation alert). |

---

### 19 · `migration-runner` — Per-environment

**Name:** Migration Runner Compiler

| Field | Detail |
|---|---|
| **Input** | Migration files (already compiled by `db-migration`), lock strategy (advisory lock / migration table), rollback spec (down migrations available), pre-deploy vs. post-deploy classification per migration, timeout budget. |
| **Output** | Migration `Job.yaml` (K8s pre-deploy hook), lock table migration file, `migration-runner.sh` (script with advisory lock, timeout, rollback on failure), Helm pre-upgrade hook config. |
| **Correctness gates** | (1) Advisory lock acquired before first migration statement — `SELECT pg_try_advisory_lock(hash)` present at script start. (2) Lock released in `finally`/`trap EXIT` block — grep assertion. (3) Script exits non-zero on any migration failure — `set -e` or equivalent present. (4) No migration marked as `post-deploy` depends on a `pre-deploy` migration in the same release — dependency graph check. (5) Timeout kills migration job at `timeout + 30s` — `timeout` command present with value. (6) Rollback path tested: applying then rolling back all migrations in CI returns DB to original state — migration CI test job assertion. |
| **Dependencies** | `db-migration` (migration files), `secret-schema` (DB credentials), `k8s-manifest` (Job base spec). |
| **Downstream consumers** | `cd-pipeline` (migration job runs as pre-deploy hook), `integration-test-suite`. |

---

### 20 · `security-scan-config` — Per-repo / per-pipeline

**Name:** Security Scan Config Compiler

| Field | Detail |
|---|---|
| **Input** | Scan policy spec (SAST tools: Semgrep ruleset IDs; SCA: Snyk/Trivy severity threshold; DAST: ZAP scan scope; secret scan: TruffleHog config), severity thresholds (CI-blocking level: CRITICAL/HIGH/MEDIUM), ignore rules (CVE IDs with expiry dates + justification), scan frequency (on PR / nightly / on release). |
| **Output** | `.semgrep.yml`, `trivy.yaml` (or `.trivyignore`), `.trufflehog.yaml`, `snyk.policy` (or `.snyk`), `zap-scan.yaml`, CI integration step snippets. |
| **Correctness gates** | (1) All scan configs validate against their tool's schema — each tool's `--validate` or `--dry-run` flag exits 0. (2) Every ignore rule has an expiry date (`≤ 90 days`) and CVE justification — parsed from ignore file, zero entries without both fields. (3) CRITICAL severity findings block CI — grep for `--exit-code 1` or `fail_on_severity: CRITICAL` in config. (4) Secret scan covers 100% of commits since last scan — `--since-commit` or full scan mode asserted. (5) `.trivyignore` entries reference valid CVE IDs — regex `CVE-\d{4}-\d{4,}` on every entry. (6) No tool pinned to `latest` tag — all tool versions pinned in CI workflow. |
| **Dependencies** | `dockerfile` (image scan target), `ci-pipeline` (scan invoked in pipeline). |
| **Downstream consumers** | `ci-pipeline` (scan steps injected), `cd-pipeline` (gate on scan pass), `dr-runbook` (vuln response referenced). |

---

### 21 · `resource-tagging` — Per-project / per-account

**Name:** Resource Tagging Policy Compiler

| Field | Detail |
|---|---|
| **Input** | Tag taxonomy spec (mandatory tags: `Environment`, `Service`, `Team`, `CostCenter`, `ManagedBy`; optional tags; allowed values per tag), cost allocation map (tag → cost center code), enforcement level (audit / deny). |
| **Output** | `tagging-policy.tf` (AWS Config rule or Azure Policy / GCP Organization Policy), `required_tags` variable block for all `terraform-module` outputs, `conftest/tagging.rego` (OPA policy for Terraform plan enforcement). |
| **Correctness gates** | (1) OPA policy `conftest test` exits 0 against a test Terraform plan with correct tags. (2) OPA policy `conftest test` exits non-zero against a plan missing any mandatory tag — negative test. (3) Allowed values lists are exhaustive enums — no `*` wildcard allowed for mandatory tags. (4) AWS Config rule / Azure Policy deployed and reporting `COMPLIANT` — API check. (5) All tag keys are lowercase with hyphens (no spaces, no camelCase) — regex assertion on taxonomy spec. |
| **Dependencies** | `terraform-state-backend` (policies deployed via Terraform). |
| **Downstream consumers** | `terraform-module` (all modules import required_tags), `cost-budget-alert` (cost allocation by tag). |

---

### 22 · `cost-budget-alert` — Per-project / per-account

**Name:** Cost Budget Alert Compiler

| Field | Detail |
|---|---|
| **Input** | Monthly budget per service/team (dollar amounts), alert thresholds (50%, 80%, 100%, 120% of budget), notification targets (email, Slack, PagerDuty), cost anomaly detection sensitivity, per-service cost allocation (based on tags from `resource-tagging`). |
| **Output** | `budget.tf` (AWS Budgets / GCP Budget resource), `cost-anomaly-detector.tf`, alert SNS/Pub-Sub topic config. |
| **Correctness gates** | (1) `terraform validate` exits 0. (2) Budget amount > 0 — numeric check. (3) All four threshold percentages (50/80/100/120) present — count assertion on `notification` blocks. (4) At least one notification target is an escalation path (PagerDuty or on-call email), not just informational — spec cross-reference. (5) Cost anomaly detector `threshold_expression` references the correct linked account IDs — cross-reference with account list. (6) Budget filter tags match mandatory tags from `resource-tagging` spec — key name comparison. |
| **Dependencies** | `resource-tagging` (tag-based cost filters), `terraform-module` (budget resource deployed). |
| **Downstream consumers** | `dr-runbook` (budget breach is a runbook trigger scenario). |

---

### 23 · `dr-runbook` — Per-service / per-project

**Name:** Disaster Recovery Runbook Compiler

| Field | Detail |
|---|---|
| **Input** | RTO/RPO spec, failure mode catalog (DB failure, region outage, certificate expiry, secret rotation failure, queue backlog, deployment rollback), recovery steps per failure mode, contact list (on-call rotation), dependency graph (which services depend on which). |
| **Output** | `runbook.md` with YAML front-matter (machine-parseable: `rto_minutes`, `rpo_minutes`, `service`, `failure_modes[]`), `dr-test.sh` (verification script that exercises each recovery step in a test environment). |
| **Correctness gates** | (1) YAML front-matter is valid and passes schema: `rto_minutes` ≤ SLA commitment, `rpo_minutes` ≤ backup interval — cross-reference with `db-backup-config`. (2) Every failure mode in the catalog has a corresponding numbered recovery section — section header count matches failure mode list count. (3) Every step references a specific command, URL, or runbook section (no vague instructions like "check the logs") — regex: each step line matches `^[0-9]+\. (Run|Open|Execute|Verify|Check)\s+\`[^\`]+\`` or links. (4) All dashboard links in runbook return HTTP 200 — link checker script. (5) All alert names referenced exist in `prometheus-rules` output — cross-reference. (6) `dr-test.sh` is executable and exits 0 in a clean test environment. |
| **Dependencies** | `prometheus-rules`, `grafana-dashboard`, `db-backup-config`, `cd-pipeline` (rollback procedure). |
| **Downstream consumers** | Oncall tooling (PagerDuty runbook link), `backup-verification` (test exercises restore path). |

---

### 24 · `backup-verification` — Per-backup-config

**Name:** Backup Verification Compiler

| Field | Detail |
|---|---|
| **Input** | Backup job output location (S3 path pattern), restore target spec (ephemeral DB instance config), data integrity check spec (row counts per table, checksum of known rows, schema version check), verification frequency, notification target on failure. |
| **Output** | `backup-verify.CronJob.yaml` (K8s CronJob), `verify-backup.sh` (restore + integrity check script), `verification-result-schema.json` (structured result written to S3 after each run). |
| **Correctness gates** | (1) Verification fires within 24h of each backup — cron interval comparison. (2) Script restores to an ephemeral instance, never production — target host verified to not match production hostname (grep + env var check). (3) Row count check covers all tables defined in the schema — table list cross-referenced against Prisma/Drizzle schema. (4) Script writes result JSON matching `verification-result-schema.json` — `jq` schema validation on output. (5) Ephemeral instance destroyed after verification — `cleanup()` trap function present in script. (6) Failure triggers alert within 15 minutes — notification step present with PagerDuty/Slack webhook. |
| **Dependencies** | `db-backup-config` (backup job must exist), `terraform-module` (ephemeral DB provisioning), `secret-schema` (restore credentials). |
| **Downstream consumers** | `dr-runbook` (verification result referenced as DR readiness evidence). |

---

### 25 · `dev-environment` — Per-repo / per-stack-change

**Name:** Developer Environment Compiler

| Field | Detail |
|---|---|
| **Input** | Service graph (all services needed locally), local port map, hot-reload spec (which services support file-watch rebuild), required local tools list (versions), environment variable defaults for local dev, pre-commit hook spec. |
| **Output** | `.devcontainer/devcontainer.json` (or `Tiltfile` / `skaffold.yaml`), `Makefile` (standard targets: `make up`, `make down`, `make test`, `make migrate`, `make seed`), `.pre-commit-config.yaml`, `mise.toml` or `.tool-versions` (tool version pinning). |
| **Correctness gates** | (1) `make up` completes without error on a clean machine with only Docker installed — tested in CI on a fresh runner. (2) All required tool versions in `.tool-versions` / `mise.toml` are pinned to exact versions (no `~` or `^`) — regex assertion. (3) `Tiltfile` / `Skaffold.yaml` validates — `tilt ci` or `skaffold config --dry-run` exits 0. (4) Pre-commit hooks run in < 30s on a 100-file diff — measured in CI. (5) All `make` targets are documented — every target has a `## comment` (parsed by `make help`) — grep assertion. (6) `devcontainer.json` is valid JSON and schema-compliant — `devcontainer-cli validate` exits 0. (7) No hardcoded absolute paths — all paths relative or from env vars — grep for `/Users/` or `/home/` returns 0. |
| **Dependencies** | `compose-config` (local services use compose), `db-seed` (seed target uses seed script). |
| **Downstream consumers** | `local-k8s-config` (dev environment may use local K8s), `ci-pipeline` (dev environment documented for contributors). |

---

### 26 · `local-k8s-config` — Per-project

**Name:** Local Kubernetes Config Compiler

| Field | Detail |
|---|---|
| **Input** | Service graph, local infrastructure dependencies (PostgreSQL, Redis, queues), cluster type preference (kind / k3d), resource constraints (laptop CPU/memory budget), local image build strategy (registry mirror or local load), Helm chart references. |
| **Output** | `kind-config.yaml` or `k3d-config.yaml` (cluster definition), `local-values.yaml` (Helm values overrides for local: reduced replicas, no PDB, debug log level), `Makefile` targets (`make cluster-up`, `make cluster-down`, `make load-images`). |
| **Correctness gates** | (1) `kind create cluster --config kind-config.yaml --dry-run` exits 0. (2) Local Helm values set `replicaCount: 1` and `podDisruptionBudget.enabled: false` — grep assertions. (3) Resource requests in local values are ≤ 50% of production values — numeric comparison. (4) Cluster bootstraps and all pods reach `Running` state within 5 minutes — measured in CI on a GitHub Actions runner. (5) All local image references use `imagePullPolicy: Never` or `IfNotPresent` (prevents pulling from remote) — grep assertion. (6) Local storage class defined for PersistentVolumeClaims — cluster config includes `storage-class` node. |
| **Dependencies** | `helm-chart` or `kustomize-overlay` (deploys these locally), `compose-config` (infrastructure services). |
| **Downstream consumers** | `dev-environment` (local K8s integrated into dev workflow), `integration-test-suite` (can run against local cluster). |

---

### 27 · `dns-record-set` — Per-domain / per-environment

**Name:** DNS Record Set Compiler

| Field | Detail |
|---|---|
| **Input** | Domain spec (apex + subdomains per environment), record types (A / AAAA / CNAME / MX / TXT / CAA), TTL policy, health-check routing spec (latency-based / failover), SPF/DKIM/DMARC requirements (if mail-sending), CAA record restriction (allowed CAs). |
| **Output** | `dns.tf` (Terraform Route53 / Cloudflare resource block), `dns-records.md` (human-readable record list for audit), DKIM/SPF TXT record values. |
| **Correctness gates** | (1) `terraform validate` exits 0. (2) All record TTLs ≤ 300s for environment-specific records (enables fast failover) — numeric check. (3) CAA record present and restricts issuance to the CA used by cert-manager — grep for `letsencrypt.org` or configured CA. (4) DMARC record set to `p=reject` for production mail domain — dig assertion post-apply. (5) No duplicate record names within same zone/type — uniqueness check on Terraform resource names. (6) SPF record exists and ends with `-all` (hard fail), not `~all` — grep on TXT value. |
| **Dependencies** | `terraform-module` (hosted zone provisioned), `ingress-config` (IP/CNAME target from load balancer). |
| **Downstream consumers** | `ingress-config` (DNS must resolve before TLS cert issuance), `cdn-config` (CDN CNAME target). |

---

### 28 · `cdn-config` — Per-static-asset / per-API-gateway

**Name:** CDN Config Compiler

| Field | Detail |
|---|---|
| **Input** | Origin spec (ALB / S3 / API Gateway endpoint), cache policy (TTL per path pattern, cache-control header pass-through, query string forwarding), WAF rules (geo-restriction, rate limit, managed rule groups: Core, Known-Bad-Inputs), custom error page spec, compression spec (gzip/brotli), price class. |
| **Output** | `cdn.tf` (CloudFront distribution / Fastly service Terraform), `waf.tf` (WAF Web ACL), `cache-policy.tf`, `cdn-invalidation.sh` (cache invalidation script for deployments). |
| **Correctness gates** | (1) `terraform validate` exits 0. (2) WAF WebACL attached to distribution — `aws cloudfront get-distribution` response includes `WebAclId` non-empty. (3) HTTPS enforced — `ViewerProtocolPolicy: redirect-to-https` on all cache behaviors — grep on Terraform. (4) S3 origin uses OAC (Origin Access Control), not public bucket — `S3OriginConfig` block absent; `OriginAccessControlId` present. (5) Cache-Control header not overridden for API paths (only static assets) — path pattern check on cache behaviors. (6) `cdn-invalidation.sh` accepts a path argument and exits non-zero on API error — script static analysis. (7) Compression enabled (`Compress: true`) on distribution — grep assertion. |
| **Dependencies** | `terraform-module` (distribution provisioned), `dns-record-set` (CNAME to CDN), `security-scan-config` (WAF rules reviewed), `ingress-config` (origin target). |
| **Downstream consumers** | `prometheus-rules` (CDN error rate / cache hit rate alerts), `grafana-dashboard` (CDN metrics panel). |

---

## Recommended Compiler Build Order

Phases are dependency-ordered. Compilers within a phase are independent and can be parallelised.

### Phase 0 — Foundational Primitives (no dependencies)

| Compiler | Rationale |
|---|---|
| `terraform-state-backend` | All IaC depends on remote state. Must be bootstrapped first with local state, then migrated. |
| `resource-tagging` | Tag policy consumed by every Terraform module. Must exist before any cloud resource is created. |
| `security-scan-config` | Scan configs consumed by CI. Must exist before any pipeline is authored. |

---

### Phase 1 — Core IaC & Container Primitives

| Compiler | Depends On |
|---|---|
| `dockerfile` | Nothing |
| `terraform-module` | `terraform-state-backend`, `resource-tagging` |
| `secret-schema` | `terraform-module` (Vault/SSM provisioned) |
| `env-config` *(shared)* | Nothing |

---

### Phase 2 — Networking & DNS

| Compiler | Depends On |
|---|---|
| `dns-record-set` | `terraform-module` (hosted zone) |
| `network-policy` | `k8s-manifest` (pod labels) — but `k8s-manifest` is Phase 3; author network policy spec in parallel, apply after Phase 3 |

---

### Phase 3 — Kubernetes Workloads

| Compiler | Depends On |
|---|---|
| `k8s-manifest` | `dockerfile`, `secret-schema` |
| `compose-config` | `dockerfile` |
| `ingress-config` | `k8s-manifest`, `dns-record-set` |
| `network-policy` | `k8s-manifest` |

---

### Phase 4 — Service Configuration

| Compiler | Depends On |
|---|---|
| `helm-chart` | `k8s-manifest`, `secret-schema` |
| `kustomize-overlay` | `k8s-manifest` |
| `db-connection-pool` | `secret-schema`, `terraform-module`, `network-policy` |
| `cdn-config` | `terraform-module`, `dns-record-set`, `ingress-config` |

---

### Phase 5 — CI/CD Pipelines

| Compiler | Depends On |
|---|---|
| `ci-pipeline` | `dockerfile`, `security-scan-config` |
| `cd-pipeline` | `ci-pipeline`, `helm-chart` or `kustomize-overlay` |
| `migration-runner` | `secret-schema`, `k8s-manifest` |

---

### Phase 6 — Data Operations

| Compiler | Depends On |
|---|---|
| `db-backup-config` | `terraform-module`, `secret-schema`, `k8s-manifest` |
| `backup-verification` | `db-backup-config`, `terraform-module` |

---

### Phase 7 — Observability

| Compiler | Depends On |
|---|---|
| `log-pipeline` | `k8s-manifest`, `secret-schema`, `terraform-module` |
| `tracing-config` | `k8s-manifest`, `secret-schema` |
| `prometheus-rules` | `k8s-manifest` (metrics endpoint exists) |
| `grafana-dashboard` | `prometheus-rules` |

---

### Phase 8 — Cost & Budgets

| Compiler | Depends On |
|---|---|
| `cost-budget-alert` | `resource-tagging`, `terraform-module` |

---

### Phase 9 — Developer Experience

| Compiler | Depends On |
|---|---|
| `dev-environment` | `compose-config`, `db-seed` *(from backend role)* |
| `local-k8s-config` | `helm-chart` or `kustomize-overlay`, `compose-config` |

---

### Phase 10 — Resilience & DR (Terminal)

| Compiler | Depends On |
|---|---|
| `dr-runbook` | `prometheus-rules`, `grafana-dashboard`, `db-backup-config`, `cd-pipeline` |

---

### Full Dependency Graph (Critical Path)

```
terraform-state-backend ──┐
resource-tagging ──────────┤
                           ▼
                    terraform-module
                           │
         ┌─────────────────┼──────────────────────┐
         ▼                 ▼                       ▼
    secret-schema     dns-record-set          db-backup-config
         │                 │                       │
         ▼                 ▼                       ▼
    k8s-manifest ──► ingress-config          backup-verification
         │                 │
         ├──► helm-chart ──┤
         ├──► kustomize ───┤
         ├──► network-policy
         │
         ▼
    ci-pipeline ──► cd-pipeline
         │
    security-scan-config
         │
         ▼
    prometheus-rules ──► grafana-dashboard ──► dr-runbook
```

**Minimum viable DevOps path (single service, no DR):**
`terraform-state-backend` → `terraform-module` → `dockerfile` → `k8s-manifest` → `helm-chart` → `ci-pipeline` → `cd-pipeline`

**Full production-grade path adds (in order):**
`resource-tagging` → `secret-schema` → `network-policy` → `ingress-config` → `dns-record-set` → `prometheus-rules` → `grafana-dashboard` → `log-pipeline` → `db-backup-config` → `backup-verification` → `dr-runbook`

---

*Domain Compiler Network — DevOps Role Decomposition · 28 Task Types · Engineering Research*
