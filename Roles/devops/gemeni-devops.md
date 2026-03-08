# DevOps / Platform Engineer Role Decomposition: Domain Compiler Network

**Context:** Architecture spec for a DevOps Domain Compiler Network. Each compiler produces a verified, attested infrastructure or operational artifact.

---

## 1. Summary of Atomic Task Types

| Task Name (Compiler ID)     | Frequency   | Input                                 | Output                                    |
| :-------------------------- | :---------- | :------------------------------------ | :---------------------------------------- |
| **`gen_network_tf`**        | Per-project | CIDR intent, Subnet topology          | `vpc.tf`, `subnets.tf`                    |
| **`gen_iam_role`**          | Per-feature | Access requirements spec              | `iam.tf` / `vault-policy.hcl`             |
| **`gen_database_tf`**       | Per-project | DB engine, IOPS/Storage intent        | `rds.tf` / `cloudsql.tf`                  |
| **`gen_cluster_tf`**        | Per-project | K8s version, Node pool spec           | `eks.tf` / `gke.tf`                       |
| **`gen_registry_tf`**       | Per-project | Repository intent, lifecycle rules    | `ecr.tf` / `gar.tf`                       |
| **`gen_dns_record_tf`**     | Per-feature | Domain routing intent                 | `route53.tf` / `cloudflare.tf`            |
| **`gen_dockerfile`**        | Per-feature | App language, build steps, ports      | `Dockerfile`, `.dockerignore`             |
| **`gen_dev_environment`**   | Per-project | Local dependencies, hot-reload intent | `devcontainer.json` / `Tiltfile`          |
| **`gen_ci_build_test`**     | Per-feature | Linter/Test/Build intent              | `.github/workflows/ci.yml`                |
| **`gen_sast_dast_config`**  | Per-project | Security policy, language stack       | `sonar-project.properties`, CI steps      |
| **`gen_k8s_manifests`**     | Per-feature | Compute intent, env vars, ports       | `deployment.yaml`, `service.yaml`         |
| **`gen_hpa_vpa_config`**    | Per-feature | Scaling thresholds (CPU/Mem/Custom)   | `hpa.yaml`, `vpa.yaml`                    |
| **`gen_network_policy`**    | Per-feature | Microservice traffic flow intent      | `networkpolicy.yaml`                      |
| **`gen_ingress_config`**    | Per-feature | Hostname, TLS cert requirements       | `ingress.yaml` / `gateway.yaml`           |
| **`gen_sealed_secret`**     | Per-feature | Plaintext secret, public key          | `SealedSecret.yaml`                       |
| **`gen_helm_chart`**        | Per-project | Base manifests, templating intent     | `Chart.yaml`, `values.yaml`, templates    |
| **`gen_cd_pipeline`**       | Per-project | Target cluster, deployment strategy   | `Application.yaml` (ArgoCD) / CD workflow |
| **`gen_prom_alert_rule`**   | Per-feature | SLO/SLA intent, failure thresholds    | `PrometheusRule.yaml`                     |
| **`gen_grafana_dashboard`** | Per-feature | Metrics to visualize, layout intent   | `dashboard.json`, `ConfigMap.yaml`        |
| **`gen_log_parser_config`** | Per-project | Log format (JSON/regex)               | `fluentbit-parsers.conf`                  |
| **`gen_db_backup_cron`**    | Per-project | RPO intent, backup destination        | `CronJob.yaml` (K8s) or `backup.sh`       |
| **`gen_cost_tagging`**      | Per-project | Cost center, environment list         | `tags.tf`, `policy.json` (OPA/Kyverno)    |

---

## 2. Detailed Task Breakdown

### Infrastructure as Code (Foundation)

**`gen_network_tf`**

- **Frequency:** Per-project
- **Input:** CIDR block, regions, public/private topology intent.
- **Output:** Terraform files for VPC, Subnets, Nat Gateways, Route Tables.
- **Correctness criteria:** `terraform fmt -check` and `terraform validate` must pass. `tfsec` or `checkov` must report 0 high/critical CVEs. Overlapping CIDR blocks within the same state must throw an error.
- **Dependencies:** None.
- **Downstream consumers:** `gen_cluster_tf`, `gen_database_tf`.

**`gen_iam_role`**

- **Frequency:** Per-feature
- **Input:** Action spec (e.g., "read S3 bucket X", "publish to SQS Y").
- **Output:** Cloud-specific IAM policies and role attachments (Terraform).
- **Correctness criteria:** AST analysis must confirm NO wildcard (`*`) usage in `Action` or `Resource` blocks unless explicitly overridden by a security waiver.
- **Dependencies:** None.
- **Downstream consumers:** `gen_cluster_tf`, `gen_k8s_manifests` (via IRSA/Workload Identity).

**`gen_database_tf`**

- **Frequency:** Per-project
- **Input:** DB engine, size intent, Multi-AZ requirement, backup retention.
- **Output:** Terraform definitions for managed databases.
- **Correctness criteria:** Encryption at rest must be explicitly set to `true`. Deletion protection must be enabled if `env == prod`.
- **Dependencies:** `gen_network_tf`.
- **Downstream consumers:** DB Migration compilers (Backend), `gen_db_backup_cron`.

**`gen_cluster_tf`**

- **Frequency:** Per-project
- **Input:** Orchestrator type, auto-scaling intent, network IDs.
- **Output:** Terraform for K8s cluster and node groups.
- **Correctness criteria:** Control plane logging must be enabled. Nodes must be deployed into private subnets only (verified via tf-state/variables).
- **Dependencies:** `gen_network_tf`, `gen_iam_role`.
- **Downstream consumers:** All K8s manifest compilers, `gen_cd_pipeline`.

**`gen_registry_tf`**

- **Frequency:** Per-project
- **Input:** App name, retention policy (e.g., "keep last 30 images").
- **Output:** Terraform for Container Registry.
- **Correctness criteria:** Image vulnerability scanning on push must be enabled. Lifecycle policy must be attached.
- **Dependencies:** None.
- **Downstream consumers:** `gen_ci_build_test`, `gen_k8s_manifests`.

### CI & Developer Experience

**`gen_dockerfile`**

- **Frequency:** Per-feature
- **Input:** Runtime language, build commands, exposed ports.
- **Output:** `Dockerfile`, `.dockerignore`.
- **Correctness criteria:** Must pass `hadolint` with 0 errors. Base image must use a specific SHA-256 digest, not a mutable tag (e.g., `latest`). Final stage must include `USER nonroot`.
- **Dependencies:** Backend/Frontend code artifacts.
- **Downstream consumers:** `gen_ci_build_test`, `gen_dev_environment`.

**`gen_dev_environment`**

- **Frequency:** Per-project
- **Input:** Service dependencies, required local tools.
- **Output:** `devcontainer.json`, `docker-compose.yaml`, or `Tiltfile`.
- **Correctness criteria:** Schema validation against standard DevContainer/Tilt schemas must pass. Port collisions mapped to `localhost` must be statically checked and resolved.
- **Dependencies:** `gen_dockerfile`.
- **Downstream consumers:** None (End-user consumed).

**`gen_ci_build_test`**

- **Frequency:** Per-feature
- **Input:** Test commands, linting rules, target registry.
- **Output:** CI Pipeline YAML (e.g., GitHub Actions).
- **Correctness criteria:** YAML must pass `actionlint`. Must include caching steps for the specified language package manager. Pipeline must fail if test coverage drops below defined threshold.
- **Dependencies:** `gen_dockerfile`, `gen_registry_tf`.
- **Downstream consumers:** `gen_cd_pipeline`.

**`gen_sast_dast_config`**

- **Frequency:** Per-project
- **Input:** Target languages, framework types, exclusion paths.
- **Output:** SAST scanner config (e.g., SonarQube, Trivy).
- **Correctness criteria:** Config must map exclusively to valid scanner rule IDs. Exclusion paths must be valid regex or glob patterns.
- **Dependencies:** None.
- **Downstream consumers:** `gen_ci_build_test`.

### Container Orchestration (Kubernetes)

**`gen_k8s_manifests`**

- **Frequency:** Per-feature
- **Input:** Container image, port mapping, env var intent, resource limits.
- **Output:** `deployment.yaml`, `service.yaml`.
- **Correctness criteria:** Must pass `kubeconform` against the target cluster API version. `resources.requests` and `resources.limits` MUST be explicitly defined. `readinessProbe` and `livenessProbe` MUST be present.
- **Dependencies:** `gen_dockerfile`, `gen_iam_role`.
- **Downstream consumers:** `gen_helm_chart`, `gen_cd_pipeline`, `gen_hpa_vpa_config`.

**`gen_hpa_vpa_config`**

- **Frequency:** Per-feature
- **Input:** Target CPU/Memory utilization percentages, min/max replicas.
- **Output:** `HorizontalPodAutoscaler.yaml` / `VerticalPodAutoscaler.yaml`.
- **Correctness criteria:** Target reference must point to a valid generated Deployment. `maxReplicas` must be strictly greater than `minReplicas`.
- **Dependencies:** `gen_k8s_manifests`.
- **Downstream consumers:** `gen_cd_pipeline`.

**`gen_network_policy`**

- **Frequency:** Per-feature
- **Input:** Allowed ingress/egress service dependencies.
- **Output:** `NetworkPolicy.yaml`.
- **Correctness criteria:** Default deny-all must be present if no rules are specified. Pod selectors must match existing deployments exactly.
- **Dependencies:** `gen_k8s_manifests`.
- **Downstream consumers:** `gen_cd_pipeline`.

**`gen_ingress_config`**

- **Frequency:** Per-feature
- **Input:** Hostname routing intent, TLS requirement.
- **Output:** `Ingress.yaml` or Gateway API routes.
- **Correctness criteria:** Backend service names and ports must match the outputs of `gen_k8s_manifests`. TLS secret names must be defined if HTTPS is required.
- **Dependencies:** `gen_k8s_manifests`, `gen_dns_record_tf`.
- **Downstream consumers:** `gen_cd_pipeline`.

**`gen_sealed_secret`**

- **Frequency:** Per-feature
- **Input:** Plaintext Key-Value pairs, target namespace, public encryption key.
- **Output:** `SealedSecret.yaml` (Bitnami) or ExternalSecret definition.
- **Correctness criteria:** Payload must be cryptographically decryptable ONLY by the cluster's private key (verified via dry-run CLI tool). Base64 encoding must be valid.
- **Dependencies:** Cluster PKI / `gen_cluster_tf`.
- **Downstream consumers:** `gen_k8s_manifests`.

**`gen_helm_chart`**

- **Frequency:** Per-project
- **Input:** Generated K8s manifests, templating intent.
- **Output:** Standard Helm Chart directory structure.
- **Correctness criteria:** `helm lint` MUST return 0 errors. `helm template` MUST output valid YAML (verified via `kubeconform`).
- **Dependencies:** All K8s manifest compilers.
- **Downstream consumers:** `gen_cd_pipeline`.

### Delivery & Operations

**`gen_cd_pipeline`**

- **Frequency:** Per-project
- **Input:** Chart location, target cluster, sync policy (e.g., auto-prune).
- **Output:** ArgoCD `Application.yaml` or Flux `Kustomization.yaml`.
- **Correctness criteria:** Target namespace must be defined. Sync policy must match environment intent (manual for prod, auto for dev).
- **Dependencies:** `gen_helm_chart`, `gen_cluster_tf`.
- **Downstream consumers:** Target K8s Cluster.

**`gen_prom_alert_rule`**

- **Frequency:** Per-feature
- **Input:** Metric threshold intent (e.g., "HTTP 500s > 5% for 5m").
- **Output:** `PrometheusRule.yaml`.
- **Correctness criteria:** `promtool check rules` MUST pass. PromQL query must be syntactically valid and contain `runbook_url` in the annotations.
- **Dependencies:** Target application metrics specs.
- **Downstream consumers:** Prometheus Operator.

**`gen_grafana_dashboard`**

- **Frequency:** Per-feature
- **Input:** Metric queries, layout intent (charts vs tables).
- **Output:** `dashboard.json` wrapped in K8s ConfigMap.
- **Correctness criteria:** Must validate against the official Grafana Dashboard JSON Schema. Data source references must use variables, not hardcoded UIDs.
- **Dependencies:** None.
- **Downstream consumers:** Grafana Operator.

**`gen_db_backup_cron`**

- **Frequency:** Per-project
- **Input:** Backup frequency (cron syntax), target S3 bucket.
- **Output:** K8s `CronJob.yaml` containing backup CLI logic.
- **Correctness criteria:** Cron expression must be valid. Must include `successfulJobsHistoryLimit` and `failedJobsHistoryLimit` to prevent pod accumulation.
- **Dependencies:** `gen_database_tf`.
- **Downstream consumers:** Target K8s Cluster.

**`gen_cost_tagging`**

- **Frequency:** Per-project
- **Input:** Required tags (Environment, Owner, CostCenter).
- **Output:** Terraform default tags blocks, Kyverno/OPA policies for K8s.
- **Correctness criteria:** Tag keys must adhere to a regex pattern (no spaces, specific casing). OPA policies must successfully evaluate a dummy manifest.
- **Dependencies:** None.
- **Downstream consumers:** All infrastructure compilers.

---

## 3. Recommended Build Order (Dependency Graph)

A Platform/DevOps compiler network must build from the ground up: physical resources -> access -> images -> deployment -> operations.

**Layer 0: Policy & Configuration**

1. `gen_cost_tagging`
2. `gen_sast_dast_config`

**Layer 1: Base Infrastructure (IaC)** 3. `gen_network_tf` — The foundation. 4. `gen_iam_role` — Security boundaries. 5. `gen_registry_tf` — Artifact storage.

**Layer 2: Compute & State (IaC)** 6. `gen_cluster_tf` — Requires Network & IAM. 7. `gen_database_tf` — Requires Network. 8. `gen_dns_record_tf` — Maps to infrastructure.

**Layer 3: Application Artifacts (CI)** 9. `gen_dockerfile` — Builds the container. 10. `gen_dev_environment` — Wraps the container for local dev. 11. `gen_ci_build_test` — Orchestrates the build & push.

**Layer 4: Orchestration Intent (K8s)** 12. `gen_sealed_secret` — Encrypts configs. 13. `gen_k8s_manifests` — Requires Images & Secrets. 14. `gen_hpa_vpa_config` — Attaches to Manifests. 15. `gen_network_policy` — Secures Manifests. 16. `gen_ingress_config` — Exposes Manifests.

**Layer 5: Packaging & Delivery (CD)** 17. `gen_helm_chart` — Bundles Layer 4. 18. `gen_cd_pipeline` — Deploys Layer 5 to Layer 2.

**Layer 6: Day 2 Operations (Observability & Ops)** 19. `gen_prom_alert_rule` 20. `gen_grafana_dashboard` 21. `gen_log_parser_config` 22. `gen_db_backup_cron`
