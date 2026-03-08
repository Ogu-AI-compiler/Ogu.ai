# DevOps role decomposition for a Domain Compiler Network

This document decomposes the DevOps / Platform engineer role into atomic, compiler-ready task types.

Principles used here:

- Each task type is defined by the artifact it produces.
- Correctness criteria are binary and machine-checkable.
- Tasks are small enough to automate with one focused compiler.
- Scope covers only DevOps / Platform artifacts, not backend application code.

Frequency classes:

- `daily`
- `per-feature`
- `per-project`
- `per-incident`

## 1. Summary table

| Task Name (Compiler ID) | Frequency | Input | Output |
|---|---|---|---|
| `ci_cd_pipeline` | daily | Build-test-release policy, repo layout, branch strategy, required checks, target environments | `.github/workflows/*.yml` or `.gitlab-ci.yml` or `Jenkinsfile` |
| `iac_stack_definition` | per-project | Infra spec, target cloud, environment matrix, state backend choice, module inputs | `*.tf`, `Pulumi.yaml`, `Pulumi.<stack>.yaml`, `infra/**/*.ts`, `cdk.out/` or equivalent synthesized artifacts |
| `network_dns_config` | per-feature | Hostname plan, service exposure spec, TLS requirements, target load balancer or gateway outputs | DNS zone files, Terraform DNS resources, Gateway/Ingress host config fragments, TLS record metadata |
| `env_schema` | daily | Service config contract, environment list, required secrets, default values, type constraints | `.env.example`, `env.schema.json`, `config.schema.ts`, generated config docs |
| `secret_bundle` | per-feature | Secret map, target namespaces, source secret manager path, env schema, rotation policy | `sealed-secrets/*.yaml`, `externalsecrets/*.yaml`, Kubernetes Secret templates, secret injection config |
| `vault_policy` | per-feature | Access matrix, Vault paths, workloads, namespaces, rotation requirements | `vault/policies/*.hcl`, auth role bindings, policy assignment manifests |
| `dockerfile_image` | daily | Runtime requirements, build context, app start command, ports, package manager choice | `Dockerfile`, optional `.dockerignore`, build args metadata |
| `kubernetes_workload` | per-feature | Deployment spec, image reference, replicas, resources, env schema, secrets, rollout policy | `k8s/deployments/*.yaml`, `k8s/statefulsets/*.yaml`, `k8s/daemonsets/*.yaml` |
| `kubernetes_service` | per-feature | Service exposure spec, workload labels, port map, internal/external access intent | `k8s/services/*.yaml` |
| `kubernetes_ingress_gateway` | per-feature | External routing spec, hostnames, path rules, TLS settings, backend services | `k8s/ingress/*.yaml`, `k8s/gateway/*.yaml`, `k8s/httproutes/*.yaml` |
| `helm_chart` | per-project | Parameterized deployment spec, reusable workload/service templates, default values, release name rules | `charts/<name>/Chart.yaml`, `charts/<name>/values.yaml`, `charts/<name>/templates/*` |
| `kustomize_overlay` | per-feature | Base manifests or Helm-rendered output, environment-specific patches, image tags, namespace overrides | `k8s/overlays/*/kustomization.yaml`, patches, generated config fragments |
| `healthcheck_probe_config` | per-feature | Readiness policy, startup behavior, port/path map, failure thresholds, workload type | Probe fragments inside workload manifests or `probes/*.yaml` |
| `background_worker_runtime` | per-feature | Queue worker spec, concurrency limits, image reference, queue names, autoscaling rules | Worker Deployment or StatefulSet manifests, HPA/KEDA manifests, worker values files |
| `scheduled_job` | per-feature | Cron schedule, job command, runtime image, retry policy, secret/env needs | `k8s/cronjobs/*.yaml`, Jenkins scheduled pipeline entries, GitHub schedule workflow fragments |
| `data_seed_job` | per-feature | Seed dataset spec, target environment policy, seed command, database credentials, idempotency contract | Seed job manifests, `scripts/seed.*`, seed pipeline job definitions |
| `db_migration_runner` | per-feature | Migration artifact bundle, database connection spec, execution policy, release order | Pipeline jobs, Kubernetes Job manifests, wrapper scripts for `prisma migrate deploy`, `drizzle-kit migrate`, or equivalent |
| `connection_pool_config` | per-project | Database concurrency profile, pool size requirements, auth mode, TLS mode, failover policy | `pgbouncer.ini`, sidecar values, Terraform service config, pooler deployment manifests |
| `db_backup_job` | per-project | Backup policy, schedule, storage destination, encryption policy, retention count, DB connection spec | Backup scripts, CronJobs, CI schedule jobs, object storage lifecycle config snippets |
| `backup_verification_job` | per-project | Backup artifact location, restore target spec, verification query set, schedule or trigger policy | Restore-and-verify scripts, CI jobs, Kubernetes Jobs for ephemeral restore verification |
| `prometheus_rule_group` | per-feature | SLOs, error conditions, burn-rate policy, scrape labels, recording-rule needs | `prometheus/rules/*.yml`, Alertmanager route labels, recording rules |
| `grafana_dashboard_bundle` | per-feature | Monitoring spec, dashboard layout, metric list, datasource UIDs, alert links | Provisioned dashboard JSON, dashboard folders, Grafana provisioning YAML |
| `edge_policy_bundle` | per-feature | Webhook exposure spec, rate-limit policy, IP allowlist, signature verification secret refs, backend service mapping | Ingress annotations, API gateway plugin config, NGINX/Traefik rate-limit config, webhook route manifests |
| `security_scan_pipeline` | daily | Security policy, scan thresholds, container/image targets, source paths, release blocking rules | CI jobs for SAST, DAST, image scan, dependency audit, SARIF/JSON report artifacts |
| `cost_tagging_policy` | per-project | FinOps tag taxonomy, cost-center mapping, environment map, ownership metadata | IaC tag maps, policy packs, label injection modules, admission policy config |
| `rightsizing_profile` | per-feature | Usage policy, target SLO, observed metrics window, workload classes, autoscaling strategy | Resource request/limit patches, HPA/VPA manifests, workload sizing values files |
| `developer_platform_stack` | daily | Local dev workflow spec, required dependencies, service list, bootstrap commands, local cluster option | `compose.yaml`, `.devcontainer/devcontainer.json`, `Makefile`, `Tiltfile` or `skaffold.yaml`, kind/minikube config, local bootstrap scripts |
| `disaster_recovery_runbook` | per-incident | Backup and restore topology, critical services, DNS failover plan, RTO/RPO targets, verified recovery commands | `runbooks/disaster-recovery.md`, recovery checklists, restore command manifests, failover scripts index |

## 2. Detailed breakdown per task

### `ci_cd_pipeline`

- **Name**: `ci_cd_pipeline`
- **Frequency**: daily
- **Input**: Build-test-release policy, repo layout, branch strategy, required checks, target environments
- **Output**: `.github/workflows/*.yml` or `.gitlab-ci.yml` or `Jenkinsfile`
- **Correctness criteria**:
  - Platform linter passes: `actionlint`, GitLab CI lint API, or Jenkins declarative pipeline parse succeeds
  - At least one trigger is defined and every job belongs to a valid stage or dependency graph
  - All referenced files, scripts, caches, artifacts, secrets, and variables resolve to existing paths or declared env keys
  - No cyclic `needs` or equivalent job dependencies
  - Required quality gates are explicit: build/test/deploy or documented skipped stages
- **Dependencies**: None
- **Downstream consumers**: `security_scan_pipeline`, `db_migration_runner`, `db_backup_job`, `backup_verification_job`, `disaster_recovery_runbook`

### `iac_stack_definition`

- **Name**: `iac_stack_definition`
- **Frequency**: per-project
- **Input**: Infra spec, target cloud, environment matrix, state backend choice, module inputs
- **Output**: `*.tf`, `Pulumi.yaml`, `Pulumi.<stack>.yaml`, `infra/**/*.ts`, `cdk.out/` or equivalent synthesized artifacts
- **Correctness criteria**:
  - Terraform: `terraform fmt -check`, `terraform init -backend=false`, and `terraform validate` exit 0; or Pulumi/CDK synthesis succeeds with zero syntax errors
  - All required input variables are declared and typed
  - All outputs referenced by downstream artifacts are declared exactly once
  - No unresolved module/resource references remain after validation or synth
  - Plan or preview contains only allowed providers/resource types for the target stack policy
- **Dependencies**: `env_schema`
- **Downstream consumers**: `network_dns_config`, `cost_tagging_policy`, `secret_bundle`, `kubernetes_ingress_gateway`, `disaster_recovery_runbook`

### `network_dns_config`

- **Name**: `network_dns_config`
- **Frequency**: per-feature
- **Input**: Hostname plan, service exposure spec, TLS requirements, target load balancer or gateway outputs
- **Output**: DNS zone files, Terraform DNS resources, Gateway/Ingress host config fragments, TLS record metadata
- **Correctness criteria**:
  - All hostnames are valid FQDNs and unique within the environment
  - Every DNS target resolves to an existing load balancer, ingress, gateway, or static record target
  - TTL values are positive integers within policy bounds
  - TLS host list exactly matches exposed host rules when TLS is enabled
  - Dry-run or provider validation passes without schema errors
- **Dependencies**: `iac_stack_definition`, `kubernetes_ingress_gateway` or `edge_policy_bundle`
- **Downstream consumers**: `kubernetes_ingress_gateway`, `edge_policy_bundle`, `disaster_recovery_runbook`

### `env_schema`

- **Name**: `env_schema`
- **Frequency**: daily
- **Input**: Service config contract, environment list, required secrets, default values, type constraints
- **Output**: `.env.example`, `env.schema.json`, `config.schema.ts`, generated config docs
- **Correctness criteria**:
  - Every variable has a unique name, declared type, and required/optional status
  - Defaults conform to declared types
  - All downstream references to env vars are declared in the schema
  - No secret-marked variable has a literal value in example or committed config files
  - Schema validation test passes against sample environment files
- **Dependencies**: None
- **Downstream consumers**: `ci_cd_pipeline`, `secret_bundle`, `vault_policy`, `dockerfile_image`, `kubernetes_workload`

### `secret_bundle`

- **Name**: `secret_bundle`
- **Frequency**: per-feature
- **Input**: Secret map, target namespaces, source secret manager path, env schema, rotation policy
- **Output**: `sealed-secrets/*.yaml`, `externalsecrets/*.yaml`, Kubernetes Secret templates, secret injection config
- **Correctness criteria**:
  - Manifest schema validates and server-side dry-run passes
  - Every secret key maps to a declared env variable or documented consumer
  - No plaintext secret values appear in tracked files
  - Target namespace and secret names are unique per environment
  - All referenced secret manager paths or keys are syntactically valid
- **Dependencies**: `env_schema`
- **Downstream consumers**: `kubernetes_workload`, `background_worker_runtime`, `scheduled_job`, `db_backup_job`, `edge_policy_bundle`

### `vault_policy`

- **Name**: `vault_policy`
- **Frequency**: per-feature
- **Input**: Access matrix, Vault paths, workloads, namespaces, rotation requirements
- **Output**: `vault/policies/*.hcl`, auth role bindings, policy assignment manifests
- **Correctness criteria**:
  - Policy file parses successfully
  - Every path is within an allowed prefix list
  - Capabilities are from the allowed set and match least-privilege policy rules
  - No wildcard path is used unless explicitly allowed by policy exceptions file
  - All bound roles or service accounts referenced by the policy exist
- **Dependencies**: `env_schema`, `secret_bundle`
- **Downstream consumers**: `secret_bundle`, `kubernetes_workload`, `background_worker_runtime`, `db_backup_job`

### `dockerfile_image`

- **Name**: `dockerfile_image`
- **Frequency**: daily
- **Input**: Runtime requirements, build context, app start command, ports, package manager choice
- **Output**: `Dockerfile`, optional `.dockerignore`, build args metadata
- **Correctness criteria**:
  - `docker build` succeeds from the declared context
  - Exactly one effective entrypoint or command path is defined
  - Container runs as non-root unless an approved exception is present
  - Base image is pinned to a version tag or digest according to policy
  - Exposed ports and healthcheck targets match declared service or probe config when present
- **Dependencies**: `env_schema`
- **Downstream consumers**: `kubernetes_workload`, `background_worker_runtime`, `scheduled_job`, `developer_platform_stack`, `ci_cd_pipeline`

### `kubernetes_workload`

- **Name**: `kubernetes_workload`
- **Frequency**: per-feature
- **Input**: Deployment spec, image reference, replicas, resources, env schema, secrets, rollout policy
- **Output**: `k8s/deployments/*.yaml`, `k8s/statefulsets/*.yaml`, `k8s/daemonsets/*.yaml`
- **Correctness criteria**:
  - Server-side `kubectl apply --dry-run=server` or schema validation passes
  - Selector labels exactly match pod template labels
  - Every container has image, resource requests, and resource limits unless policy explicitly exempts it
  - All referenced config maps, secrets, and service accounts exist or are declared in the same render output
  - Replica counts and rollout strategy values are valid non-negative integers and supported enum values
- **Dependencies**: `dockerfile_image`, `env_schema`, `secret_bundle`
- **Downstream consumers**: `kubernetes_service`, `healthcheck_probe_config`, `prometheus_rule_group`, `rightsizing_profile`, `helm_chart`, `kustomize_overlay`

### `kubernetes_service`

- **Name**: `kubernetes_service`
- **Frequency**: per-feature
- **Input**: Service exposure spec, workload labels, port map, internal/external access intent
- **Output**: `k8s/services/*.yaml`
- **Correctness criteria**:
  - Manifest validates and dry-run passes
  - Selector resolves to at least one declared workload label set
  - Each service port maps to an existing target port or named container port
  - Service type is in the allowed set for the environment
  - No duplicate port names or numbers exist within the same Service
- **Dependencies**: `kubernetes_workload`
- **Downstream consumers**: `kubernetes_ingress_gateway`, `edge_policy_bundle`, `network_dns_config`, `developer_platform_stack`

### `kubernetes_ingress_gateway`

- **Name**: `kubernetes_ingress_gateway`
- **Frequency**: per-feature
- **Input**: External routing spec, hostnames, path rules, TLS settings, backend services
- **Output**: `k8s/ingress/*.yaml`, `k8s/gateway/*.yaml`, `k8s/httproutes/*.yaml`
- **Correctness criteria**:
  - Manifest validates and dry-run passes
  - Every backend service name and port resolves to an existing Service
  - Hostnames are valid and unique per route scope
  - TLS secret references exist and hostnames in TLS blocks match route hosts
  - Path match types and rule structure conform to the target API schema
- **Dependencies**: `kubernetes_service`, `network_dns_config` or hostname spec
- **Downstream consumers**: `network_dns_config`, `edge_policy_bundle`, `disaster_recovery_runbook`

### `helm_chart`

- **Name**: `helm_chart`
- **Frequency**: per-project
- **Input**: Parameterized deployment spec, reusable workload/service templates, default values, release name rules
- **Output**: `charts/<name>/Chart.yaml`, `charts/<name>/values.yaml`, `charts/<name>/templates/*`
- **Correctness criteria**:
  - `helm lint` exits 0
  - `helm template` renders successfully with default values and at least one environment override set
  - Chart metadata fields required by Helm are present
  - Rendered output contains no unresolved template expressions
  - Every values key consumed by templates exists in `values.yaml` or a documented subchart dependency
- **Dependencies**: `kubernetes_workload`, `kubernetes_service`, `kubernetes_ingress_gateway`, `healthcheck_probe_config`
- **Downstream consumers**: `kustomize_overlay`, `ci_cd_pipeline`

### `kustomize_overlay`

- **Name**: `kustomize_overlay`
- **Frequency**: per-feature
- **Input**: Base manifests or Helm-rendered output, environment-specific patches, image tags, namespace overrides
- **Output**: `k8s/overlays/*/kustomization.yaml`, patches, generated config fragments
- **Correctness criteria**:
  - `kustomize build` exits 0
  - Every patch target resolves to exactly one resource
  - Rendered manifests pass schema validation
  - No duplicate resource IDs exist in the rendered output
  - Namespace, image tag, and replica overrides match policy for the target environment
- **Dependencies**: `kubernetes_workload`, `kubernetes_service`, `kubernetes_ingress_gateway` or `helm_chart`
- **Downstream consumers**: `ci_cd_pipeline`, `disaster_recovery_runbook`

### `healthcheck_probe_config`

- **Name**: `healthcheck_probe_config`
- **Frequency**: per-feature
- **Input**: Readiness policy, startup behavior, port/path map, failure thresholds, workload type
- **Output**: Probe fragments inside workload manifests or `probes/*.yaml`
- **Correctness criteria**:
  - Each referenced port exists on the target container
  - HTTP, TCP, exec, or gRPC probe schema validates for the chosen type
  - Threshold and timing fields are positive integers
  - Readiness and liveness probes are both defined, or an explicit exemption flag exists
  - Startup probe, if defined, does not conflict with readiness/liveness field rules
- **Dependencies**: `kubernetes_workload`
- **Downstream consumers**: `kubernetes_workload`, `rightsizing_profile`, `prometheus_rule_group`

### `background_worker_runtime`

- **Name**: `background_worker_runtime`
- **Frequency**: per-feature
- **Input**: Queue worker spec, concurrency limits, image reference, queue names, autoscaling rules
- **Output**: Worker Deployment or StatefulSet manifests, HPA/KEDA manifests, worker values files
- **Correctness criteria**:
  - All manifests validate and dry-run passes
  - Referenced image and queue/env bindings exist
  - Replicas or autoscaling bounds are valid and non-negative
  - Worker workload is not exposed through an external Service unless explicitly allowed
  - Termination grace period and restart policy are set according to worker policy
- **Dependencies**: `dockerfile_image`, `env_schema`, `secret_bundle`, `kubernetes_workload`
- **Downstream consumers**: `scheduled_job`, `prometheus_rule_group`, `rightsizing_profile`, `disaster_recovery_runbook`

### `scheduled_job`

- **Name**: `scheduled_job`
- **Frequency**: per-feature
- **Input**: Cron schedule, job command, runtime image, retry policy, secret/env needs
- **Output**: `k8s/cronjobs/*.yaml`, Jenkins scheduled pipeline entries, GitHub schedule workflow fragments
- **Correctness criteria**:
  - Cron expression parses successfully
  - Job template validates and referenced image/command exists
  - Concurrency policy is explicitly set
  - Backoff limit and history limits are valid non-negative integers
  - Scheduled workload does not mount or reference undeclared secrets/config
- **Dependencies**: `dockerfile_image`, `env_schema`, `secret_bundle`
- **Downstream consumers**: `db_backup_job`, `backup_verification_job`, `data_seed_job`, `disaster_recovery_runbook`

### `data_seed_job`

- **Name**: `data_seed_job`
- **Frequency**: per-feature
- **Input**: Seed dataset spec, target environment policy, seed command, database credentials, idempotency contract
- **Output**: Seed job manifests, `scripts/seed.*`, seed pipeline job definitions
- **Correctness criteria**:
  - Seed command path exists and is executable in the target runtime
  - Job or pipeline config validates
  - Running the seed twice in an ephemeral environment exits 0 both times and produces no duplicate-key failure
  - Target environment allowlist excludes production unless an explicit override is present
  - All required DB and app config refs resolve to declared env or secrets
- **Dependencies**: `scheduled_job` or `ci_cd_pipeline`, `env_schema`, `secret_bundle`
- **Downstream consumers**: `disaster_recovery_runbook`, `developer_platform_stack`

### `db_migration_runner`

- **Name**: `db_migration_runner`
- **Frequency**: per-feature
- **Input**: Migration artifact bundle, database connection spec, execution policy, release order
- **Output**: Pipeline jobs, Kubernetes Job manifests, wrapper scripts for `prisma migrate deploy`, `drizzle-kit migrate`, or equivalent
- **Correctness criteria**:
  - Referenced migration directory exists and contains at least one migration file when execution is enabled
  - Runner config validates in its host system
  - Execution command is from the approved migration command allowlist
  - Target database credentials are injected through declared env or secrets only
  - Ordering policy is explicit: pre-deploy, deploy, or post-deploy
- **Dependencies**: `ci_cd_pipeline`, `secret_bundle`, `env_schema`
- **Downstream consumers**: deploy workflows, `disaster_recovery_runbook`

### `connection_pool_config`

- **Name**: `connection_pool_config`
- **Frequency**: per-project
- **Input**: Database concurrency profile, pool size requirements, auth mode, TLS mode, failover policy
- **Output**: `pgbouncer.ini`, sidecar values, Terraform service config, pooler deployment manifests
- **Correctness criteria**:
  - Config file parses successfully
  - All numeric limits are positive integers
  - `max_client_conn` is greater than or equal to the largest pool size requirement
  - Auth type and TLS mode are in the approved enum set
  - Referenced DB host, port, and secret refs resolve to declared upstream artifacts
- **Dependencies**: `env_schema`, `secret_bundle`, `iac_stack_definition`
- **Downstream consumers**: `kubernetes_workload`, `background_worker_runtime`, `db_backup_job`, `disaster_recovery_runbook`

### `db_backup_job`

- **Name**: `db_backup_job`
- **Frequency**: per-project
- **Input**: Backup policy, schedule, storage destination, encryption policy, retention count, DB connection spec
- **Output**: Backup scripts, CronJobs, CI schedule jobs, object storage lifecycle config snippets
- **Correctness criteria**:
  - Backup command and destination URI are present
  - Schedule parses successfully
  - Retention count or age policy is explicitly set and greater than zero
  - Output artifact includes checksum or manifest generation step
  - Job config validates and uses declared secrets, not literal credentials
- **Dependencies**: `scheduled_job`, `secret_bundle`, `connection_pool_config` or direct DB config
- **Downstream consumers**: `backup_verification_job`, `disaster_recovery_runbook`

### `backup_verification_job`

- **Name**: `backup_verification_job`
- **Frequency**: per-project
- **Input**: Backup artifact location, restore target spec, verification query set, schedule or trigger policy
- **Output**: Restore-and-verify scripts, CI jobs, Kubernetes Jobs for ephemeral restore verification
- **Correctness criteria**:
  - Verification job config validates
  - Restore target is explicitly non-production
  - Latest backup restore completes with exit code 0 in the verification environment
  - Post-restore verification queries or checksum checks all pass
  - Verification result artifact is emitted to a known path
- **Dependencies**: `db_backup_job`, `ci_cd_pipeline` or `scheduled_job`, `secret_bundle`
- **Downstream consumers**: `disaster_recovery_runbook`

### `prometheus_rule_group`

- **Name**: `prometheus_rule_group`
- **Frequency**: per-feature
- **Input**: SLOs, error conditions, burn-rate policy, scrape labels, recording-rule needs
- **Output**: `prometheus/rules/*.yml`, Alertmanager route labels, recording rules
- **Correctness criteria**:
  - `promtool check rules` exits 0
  - Alert names are unique within the rendered ruleset
  - Each alert has `expr`, severity label, and summary annotation
  - Recording rule names are valid metric names with no whitespace
  - Rule groups reference only known job or metric label conventions for the target environment
- **Dependencies**: `kubernetes_workload` or `background_worker_runtime`, `healthcheck_probe_config`
- **Downstream consumers**: `grafana_dashboard_bundle`, `disaster_recovery_runbook`, `rightsizing_profile`

### `grafana_dashboard_bundle`

- **Name**: `grafana_dashboard_bundle`
- **Frequency**: per-feature
- **Input**: Monitoring spec, dashboard layout, metric list, datasource UIDs, alert links
- **Output**: Provisioned dashboard JSON, dashboard folders, Grafana provisioning YAML
- **Correctness criteria**:
  - Dashboard JSON parses successfully
  - Required top-level fields such as title, panels, and schema version are present
  - Every datasource UID referenced in panels exists in provisioning config or allowed datasource map
  - Panel IDs are unique within each dashboard
  - Provisioning YAML validates and points to existing dashboard files
- **Dependencies**: `prometheus_rule_group`
- **Downstream consumers**: `disaster_recovery_runbook`, `rightsizing_profile`

### `edge_policy_bundle`

- **Name**: `edge_policy_bundle`
- **Frequency**: per-feature
- **Input**: Webhook exposure spec, rate-limit policy, IP allowlist, signature verification secret refs, backend service mapping
- **Output**: Ingress annotations, API gateway plugin config, NGINX/Traefik rate-limit config, webhook route manifests
- **Correctness criteria**:
  - Rendered config validates for the target controller or gateway
  - Every backend reference resolves to an existing Service or route target
  - Rate-limit values are numeric and greater than zero
  - Webhook routes that require verification reference a declared secret or key source
  - Allowed methods, paths, and source CIDRs are explicitly enumerated when policy requires them
- **Dependencies**: `kubernetes_service`, `secret_bundle`, `kubernetes_ingress_gateway`
- **Downstream consumers**: `network_dns_config`, `disaster_recovery_runbook`

### `security_scan_pipeline`

- **Name**: `security_scan_pipeline`
- **Frequency**: daily
- **Input**: Security policy, scan thresholds, container/image targets, source paths, release blocking rules
- **Output**: CI jobs for SAST, DAST, image scan, dependency audit, SARIF/JSON report artifacts
- **Correctness criteria**:
  - Pipeline config validates in the target CI system
  - Each configured scan emits a report artifact at a declared path
  - Fail thresholds are explicit and machine-readable
  - Referenced source directories, URLs, or images exist
  - Blocking versus non-blocking behavior is declared per scan stage
- **Dependencies**: `ci_cd_pipeline`, `dockerfile_image` or deploy target config
- **Downstream consumers**: release decisions, `disaster_recovery_runbook`

### `cost_tagging_policy`

- **Name**: `cost_tagging_policy`
- **Frequency**: per-project
- **Input**: FinOps tag taxonomy, cost-center mapping, environment map, ownership metadata
- **Output**: IaC tag maps, policy packs, label injection modules, admission policy config
- **Correctness criteria**:
  - All required tag keys are present for every managed resource in plan or rendered manifest output
  - Tag values are non-empty and match allowed regex or enum sets
  - Ownership and environment tags resolve to known team and env identifiers
  - Policy check over plan or manifest output exits 0
  - No forbidden tags or label keys are present
- **Dependencies**: `iac_stack_definition`, `kubernetes_workload`
- **Downstream consumers**: `rightsizing_profile`, cost reporting, `disaster_recovery_runbook`

### `rightsizing_profile`

- **Name**: `rightsizing_profile`
- **Frequency**: per-feature
- **Input**: Usage policy, target SLO, observed metrics window, workload classes, autoscaling strategy
- **Output**: Resource request/limit patches, HPA/VPA manifests, workload sizing values files
- **Correctness criteria**:
  - CPU and memory quantities parse successfully
  - For every container, request is less than or equal to limit when both are set
  - Autoscaler min replicas are less than or equal to max replicas
  - Metric targets are present and within allowed ranges
  - Rendered sizing config applies cleanly to existing workload names
- **Dependencies**: `kubernetes_workload`, `prometheus_rule_group` or metrics source config
- **Downstream consumers**: `kustomize_overlay`, `helm_chart`, `disaster_recovery_runbook`

### `developer_platform_stack`

- **Name**: `developer_platform_stack`
- **Frequency**: daily
- **Input**: Local dev workflow spec, required dependencies, service list, bootstrap commands, local cluster option
- **Output**: `compose.yaml`, `.devcontainer/devcontainer.json`, `Makefile`, `Tiltfile` or `skaffold.yaml`, kind/minikube config, local bootstrap scripts
- **Correctness criteria**:
  - `docker compose config` exits 0 when Compose output is included
  - `skaffold render` or `tilt ci` parses successfully when local K8s config is included
  - All referenced Dockerfiles, manifests, and scripts exist
  - Local env file template includes every required non-secret variable
  - Bootstrap target brings up the declared service list without unresolved dependency names
- **Dependencies**: `dockerfile_image`, `kubernetes_service` or `kubernetes_workload`, `env_schema`
- **Downstream consumers**: developer onboarding, `data_seed_job`, incident recovery workflows

### `disaster_recovery_runbook`

- **Name**: `disaster_recovery_runbook`
- **Frequency**: per-incident
- **Input**: Backup and restore topology, critical services, DNS failover plan, RTO/RPO targets, verified recovery commands
- **Output**: `runbooks/disaster-recovery.md`, recovery checklists, restore command manifests, failover scripts index
- **Correctness criteria**:
  - Runbook contains required sections: scope, triggers, prerequisites, RTO/RPO, backup source, restore steps, verification, rollback, escalation
  - Every referenced script, dashboard, and job artifact exists at the documented path
  - All command blocks are fenced and machine-extractable
  - Last-reviewed date is valid ISO-8601 and owner field is non-empty
  - At least one restore verification artifact from `backup_verification_job` is linked
- **Dependencies**: `db_backup_job`, `backup_verification_job`, `network_dns_config`, `kubernetes_ingress_gateway`, `prometheus_rule_group`, `grafana_dashboard_bundle`
- **Downstream consumers**: incident response execution

## 3. Recommended build order

Build the compiler network in this dependency order:

### Phase 1: foundation compilers

- `env_schema`
- `ci_cd_pipeline`
- `iac_stack_definition`
- `dockerfile_image`

### Phase 2: secrets and access

- `secret_bundle`
- `vault_policy`
- `network_dns_config`

### Phase 3: runtime primitives

- `kubernetes_workload`
- `kubernetes_service`
- `healthcheck_probe_config`
- `connection_pool_config`

### Phase 4: routing and packaging

- `kubernetes_ingress_gateway`
- `edge_policy_bundle`
- `helm_chart`
- `kustomize_overlay`

### Phase 5: async and data operations

- `background_worker_runtime`
- `scheduled_job`
- `data_seed_job`
- `db_migration_runner`
- `db_backup_job`
- `backup_verification_job`

### Phase 6: observability and safety

- `prometheus_rule_group`
- `grafana_dashboard_bundle`
- `security_scan_pipeline`

### Phase 7: optimization and developer experience

- `cost_tagging_policy`
- `rightsizing_profile`
- `developer_platform_stack`

### Phase 8: recovery layer

- `disaster_recovery_runbook`

### Topological dependency view

```text
env_schema -> secret_bundle -> vault_policy
env_schema -> dockerfile_image -> kubernetes_workload -> kubernetes_service -> kubernetes_ingress_gateway -> edge_policy_bundle -> network_dns_config
env_schema -> ci_cd_pipeline -> security_scan_pipeline
env_schema -> ci_cd_pipeline -> db_migration_runner
dockerfile_image -> scheduled_job -> db_backup_job -> backup_verification_job -> disaster_recovery_runbook
dockerfile_image -> background_worker_runtime -> prometheus_rule_group -> grafana_dashboard_bundle -> disaster_recovery_runbook
iac_stack_definition -> network_dns_config
iac_stack_definition -> connection_pool_config -> db_backup_job
kubernetes_workload -> healthcheck_probe_config -> prometheus_rule_group
kubernetes_workload -> helm_chart -> kustomize_overlay
kubernetes_workload -> cost_tagging_policy
kubernetes_workload -> rightsizing_profile
dockerfile_image + kubernetes_workload + kubernetes_service -> developer_platform_stack
db_backup_job + backup_verification_job + network_dns_config + kubernetes_ingress_gateway + prometheus_rule_group + grafana_dashboard_bundle -> disaster_recovery_runbook
```

### Practical priority for compiler implementation

If the goal is fastest leverage, start with compilers that unlock the most downstream artifacts:

1. `env_schema`
2. `ci_cd_pipeline`
3. `dockerfile_image`
4. `kubernetes_workload`
5. `kubernetes_service`
6. `secret_bundle`
7. `healthcheck_probe_config`
8. `kubernetes_ingress_gateway`
9. `security_scan_pipeline`
10. `scheduled_job`
11. `db_backup_job`
12. `backup_verification_job`
13. `prometheus_rule_group`
14. `grafana_dashboard_bundle`
15. `developer_platform_stack`

This ordering yields the shortest path to a functioning platform baseline: build, ship, expose, observe, secure, back up, and recover.
