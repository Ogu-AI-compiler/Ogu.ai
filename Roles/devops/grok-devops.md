DevOps Engineer Role Decomposition
Summary Table

Task Name (Compiler ID)FrequencyInputOutputcreate_ci_pipelinePer-projectCI requirements spec (e.g., build/test steps)CI config file (e.g., .github/workflows/ci.yaml)create_cd_pipelinePer-featureCD requirements spec (e.g., deploy targets)CD config file (e.g., .github/workflows/cd.yaml)define_terraform_modulePer-featureResource module spec (e.g., EC2 instance params)Terraform module directory (e.g., modules/ec2/main.tf, variables.tf)create_terraform_rootPer-projectInfrastructure layout specTerraform root config (e.g., main.tf, terraform.tfvars)generate_dockerfilePer-featureContainer build spec (e.g., base image, deps)Dockerfilecreate_docker_composePer-projectLocal services specdocker-compose.yamldefine_k8s_deploymentPer-featureDeployment spec (e.g., replicas, env vars)Kubernetes YAML (e.g., deployment.yaml)create_helm_chartPer-projectChart structure specHelm chart directory (e.g., Chart.yaml, values.yaml, templates/)define_kustomize_overlayPer-featureCustomization spec (e.g., env-specific patches)Kustomize files (e.g., kustomization.yaml, patches/)configure_prom_scrapePer-projectMetrics endpoints specPrometheus config YAML (e.g., prometheus.yml scrape_configs)create_grafana_dashboardPer-featureDashboard spec (e.g., panels, queries)Grafana dashboard JSON (e.g., dashboard.json)define_alert_rulesPer-featureAlerting spec (e.g., thresholds)Alert rules YAML (e.g., alerts.yaml)create_vault_policyPer-projectAccess policy specVault policy HCL (e.g., policy.hcl)seal_secrets_configPer-featureSecrets specSealed secrets YAML (e.g., sealed-secret.yaml)configure_dns_recordsPer-featureDNS entries specDNS config (e.g., Terraform resource for Route53)create_db_backup_scriptPer-projectBackup strategy specBackup script (e.g., backup.sh or pg_dump wrapper)configure_db_migration_runnerPer-projectMigration tool specMigration config (e.g., flyway.conf or script)setup_sast_scannerPer-projectSAST rules specSAST config (e.g., .semgrep.yaml or sonar-project.properties)configure_dast_testsPer-featureDAST targets specDAST config (e.g., zap.yaml or OWASP ZAP script)audit_dependenciesPer-featureDep audit specAudit script (e.g., npm-audit.yaml or dependabot config)apply_resource_tagsPer-featureTagging policy specTagging config (e.g., Terraform tags block)rightsize_resourcesPer-incidentSizing analysis specUpdated resource specs (e.g., Terraform instance_type)create_dr_runbookPer-projectDR procedures specRunbook Markdown (e.g., dr-runbook.md)verify_backupPer-incidentBackup verification specVerification script (e.g., restore-test.sh)setup_local_dev_envPer-projectDev env specDev setup script (e.g., setup-minikube.sh)configure_tilt_skaffoldPer-projectBuild tool specTiltfile or skaffold.yamldefine_network_securityPer-featureSecurity rules specNSG config (e.g., Terraform security_group)configure_connection_poolingPer-projectPooling params specPooler config (e.g., pgbouncer.ini)setup_logging_configPer-projectLogging specLogging config (e.g., fluentd.conf)configure_tracingPer-projectTracing specTracing config (e.g., jaeger.yaml)
Detailed Breakdown Per Task
create_ci_pipeline

Name: create_ci_pipeline
Frequency: Per-project
Input: CI requirements spec (e.g., build/test steps in JSON or natural language)
Output: CI config file (e.g., .github/workflows/ci.yaml)
Correctness criteria: YAML validates against schema; lint passes (e.g., actionlint); all steps reference valid actions; no syntax errors; required jobs (build, test) present
Dependencies: None
Downstream consumers: create_cd_pipeline, setup_sast_scanner, audit_dependencies

create_cd_pipeline

Name: create_cd_pipeline
Frequency: Per-feature
Input: CD requirements spec (e.g., deploy targets, triggers)
Output: CD config file (e.g., .github/workflows/cd.yaml)
Correctness criteria: YAML validates; depends on CI success; secrets referenced exist; deployment steps idempotent; lint passes
Dependencies: create_ci_pipeline
Downstream consumers: define_k8s_deployment, create_helm_chart

define_terraform_module

Name: define_terraform_module
Frequency: Per-feature
Input: Resource module spec (e.g., params, outputs)
Output: Terraform module directory (e.g., modules/ec2/main.tf, variables.tf, outputs.tf)
Correctness criteria: Terraform fmt passes; validate succeeds; no unused vars; outputs defined; HCL parses without errors
Dependencies: None
Downstream consumers: create_terraform_root, configure_dns_records, define_network_security

create_terraform_root

Name: create_terraform_root
Frequency: Per-project
Input: Infrastructure layout spec
Output: Terraform root config (e.g., main.tf, terraform.tfvars)
Correctness criteria: Terraform init/validate passes; references existing modules; no hard-coded secrets; plan shows expected resources
Dependencies: define_terraform_module
Downstream consumers: apply_resource_tags, rightsize_resources

generate_dockerfile

Name: generate_dockerfile
Frequency: Per-feature
Input: Container build spec (e.g., base image, deps install)
Output: Dockerfile
Correctness criteria: Docker build succeeds in dry-run; no vulnerabilities in base image (via trivy scan); multi-stage if >1 layer; no root user
Dependencies: None
Downstream consumers: create_docker_compose, define_k8s_deployment

create_docker_compose

Name: create_docker_compose
Frequency: Per-project
Input: Local services spec
Output: docker-compose.yaml
Correctness criteria: YAML validates; up command starts without errors; networks/volumes defined; healthchecks present
Dependencies: generate_dockerfile
Downstream consumers: setup_local_dev_env

define_k8s_deployment

Name: define_k8s_deployment
Frequency: Per-feature
Input: Deployment spec (e.g., replicas, env vars)
Output: Kubernetes YAML (e.g., deployment.yaml)
Correctness criteria: Kubectl apply dry-run succeeds; lint (kubelint) passes; no privileged containers; resources limits set
Dependencies: generate_dockerfile
Downstream consumers: create_helm_chart, define_kustomize_overlay

create_helm_chart

Name: create_helm_chart
Frequency: Per-project
Input: Chart structure spec
Output: Helm chart directory (e.g., Chart.yaml, values.yaml, templates/)
Correctness criteria: Helm lint passes; template renders without errors; values schema validates (JSON schema); no undefined vars
Dependencies: define_k8s_deployment
Downstream consumers: define_kustomize_overlay

define_kustomize_overlay

Name: define_kustomize_overlay
Frequency: Per-feature
Input: Customization spec (e.g., env patches)
Output: Kustomize files (e.g., kustomization.yaml, patches/)
Correctness criteria: Kustomize build succeeds; patches apply without conflicts; output validates as K8s YAML
Dependencies: define_k8s_deployment, create_helm_chart
Downstream consumers: create_cd_pipeline

configure_prom_scrape

Name: configure_prom_scrape
Frequency: Per-project
Input: Metrics endpoints spec
Output: Prometheus config YAML (e.g., prometheus.yml scrape_configs)
Correctness criteria: YAML validates against Prometheus schema; scrape intervals >0; targets resolvable; reload succeeds
Dependencies: None
Downstream consumers: define_alert_rules, create_grafana_dashboard

create_grafana_dashboard

Name: create_grafana_dashboard
Frequency: Per-feature
Input: Dashboard spec (e.g., panels, queries)
Output: Grafana dashboard JSON (e.g., dashboard.json)
Correctness criteria: JSON validates against Grafana schema; queries parse (PromQL lint); no broken links; uid unique
Dependencies: configure_prom_scrape
Downstream consumers: None

define_alert_rules

Name: define_alert_rules
Frequency: Per-feature
Input: Alerting spec (e.g., thresholds)
Output: Alert rules YAML (e.g., alerts.yaml)
Correctness criteria: YAML validates; PromQL expressions valid; for/duration >0; labels/annotations present
Dependencies: configure_prom_scrape
Downstream consumers: None

create_vault_policy

Name: create_vault_policy
Frequency: Per-project
Input: Access policy spec
Output: Vault policy HCL (e.g., policy.hcl)
Correctness criteria: HCL parses; vault policy fmt passes; no wildcard paths unless specified; capabilities minimal
Dependencies: None
Downstream consumers: seal_secrets_config

seal_secrets_config

Name: seal_secrets_config
Frequency: Per-feature
Input: Secrets spec
Output: Sealed secrets YAML (e.g., sealed-secret.yaml)
Correctness criteria: Kubeseal validates; decrypts to valid secret; annotations correct; no plaintext exposure
Dependencies: create_vault_policy
Downstream consumers: define_k8s_deployment

configure_dns_records

Name: configure_dns_records
Frequency: Per-feature
Input: DNS entries spec
Output: DNS config (e.g., Terraform resource for Route53)
Correctness criteria: Terraform validate passes; records unique; TTL >0; no invalid types
Dependencies: define_terraform_module
Downstream consumers: None

create_db_backup_script

Name: create_db_backup_script
Frequency: Per-project
Input: Backup strategy spec
Output: Backup script (e.g., backup.sh or pg_dump wrapper)
Correctness criteria: Script runs without errors; produces valid dump; compression checks; retention policy enforced
Dependencies: None
Downstream consumers: verify_backup

configure_db_migration_runner

Name: configure_db_migration_runner
Frequency: Per-project
Input: Migration tool spec
Output: Migration config (e.g., flyway.conf or script)
Correctness criteria: Config parses; dry-run applies migrations; baselines match schema; no cycles
Dependencies: None
Downstream consumers: create_ci_pipeline

setup_sast_scanner

Name: setup_sast_scanner
Frequency: Per-project
Input: SAST rules spec
Output: SAST config (e.g., .semgrep.yaml or sonar-project.properties)
Correctness criteria: Config validates; scan runs without errors; rules compile; no false positives in sample
Dependencies: create_ci_pipeline
Downstream consumers: None

configure_dast_tests

Name: configure_dast_tests
Frequency: Per-feature
Input: DAST targets spec
Output: DAST config (e.g., zap.yaml or OWASP ZAP script)
Correctness criteria: Script executes; targets reachable; no auth failures; reports generate
Dependencies: create_cd_pipeline
Downstream consumers: None

audit_dependencies

Name: audit_dependencies
Frequency: Per-feature
Input: Dep audit spec
Output: Audit script (e.g., npm-audit.yaml or dependabot config)
Correctness criteria: YAML validates; audit passes on clean deps; alerts on known vulns; integrates with CI
Dependencies: create_ci_pipeline
Downstream consumers: None

apply_resource_tags

Name: apply_resource_tags
Frequency: Per-feature
Input: Tagging policy spec
Output: Tagging config (e.g., Terraform tags block)
Correctness criteria: Tags present on all resources; keys unique; values compliant (regex); validate passes
Dependencies: create_terraform_root
Downstream consumers: None

rightsize_resources

Name: rightsize_resources
Frequency: Per-incident
Input: Sizing analysis spec
Output: Updated resource specs (e.g., Terraform instance_type)
Correctness criteria: Specs within limits; cost estimate decreases; performance thresholds met; validate passes
Dependencies: create_terraform_root
Downstream consumers: None

create_dr_runbook

Name: create_dr_runbook
Frequency: Per-project
Input: DR procedures spec
Output: Runbook Markdown (e.g., dr-runbook.md)
Correctness criteria: Markdown lint passes; all steps numbered; links valid; no TODOs
Dependencies: create_db_backup_script
Downstream consumers: verify_backup

verify_backup

Name: verify_backup
Frequency: Per-incident
Input: Backup verification spec
Output: Verification script (e.g., restore-test.sh)
Correctness criteria: Script restores successfully; data integrity check (checksum); cleans up; runs in CI
Dependencies: create_db_backup_script, create_dr_runbook
Downstream consumers: None

setup_local_dev_env

Name: setup_local_dev_env
Frequency: Per-project
Input: Dev env spec
Output: Dev setup script (e.g., setup-minikube.sh)
Correctness criteria: Script idempotent; minikube starts; pods ready; no errors in logs
Dependencies: create_docker_compose
Downstream consumers: configure_tilt_skaffold

configure_tilt_skaffold

Name: configure_tilt_skaffold
Frequency: Per-project
Input: Build tool spec
Output: Tiltfile or skaffold.yaml
Correctness criteria: Tilt up / skaffold run succeeds; watches files; deploys local; lint passes
Dependencies: setup_local_dev_env
Downstream consumers: None

define_network_security

Name: define_network_security
Frequency: Per-feature
Input: Security rules spec
Output: NSG config (e.g., Terraform security_group)
Correctness criteria: Rules minimal (least privilege); ports valid; sources CIDR correct; validate passes
Dependencies: define_terraform_module
Downstream consumers: None

configure_connection_pooling

Name: configure_connection_pooling
Frequency: Per-project
Input: Pooling params spec
Output: Pooler config (e.g., pgbouncer.ini)
Correctness criteria: INI parses; pool size >0; auth mode valid; test connection succeeds
Dependencies: None
Downstream consumers: define_k8s_deployment

setup_logging_config

Name: setup_logging_config
Frequency: Per-project
Input: Logging spec
Output: Logging config (e.g., fluentd.conf)
Correctness criteria: Config loads; filters/matches defined; outputs reachable; no parse errors
Dependencies: None
Downstream consumers: create_grafana_dashboard

configure_tracing

Name: configure_tracing
Frequency: Per-project
Input: Tracing spec
Output: Tracing config (e.g., jaeger.yaml)
Correctness criteria: YAML validates; endpoints connect; sampling rate 0-1; integrates with app
Dependencies: None
Downstream consumers: define_alert_rules

Recommended Build Order
Based on the dependency graph, build compilers in topological order:

create_ci_pipeline (no deps)
generate_dockerfile (no deps)
define_terraform_module (no deps)
create_vault_policy (no deps)
create_db_backup_script (no deps)
configure_prom_scrape (no deps)
configure_db_migration_runner (no deps)
configure_connection_pooling (no deps)
setup_logging_config (no deps)
configure_tracing (no deps)
create_cd_pipeline (deps: 1)
create_docker_compose (deps: 2)
create_terraform_root (deps: 3)
seal_secrets_config (deps: 4)
configure_dns_records (deps: 3)
define_network_security (deps: 3)
define_k8s_deployment (deps: 2)
create_dr_runbook (deps: 5)
create_grafana_dashboard (deps: 6, 9)
define_alert_rules (deps: 6, 10)
setup_sast_scanner (deps: 1)
audit_dependencies (deps: 1)
apply_resource_tags (deps: 12)
rightsize_resources (deps: 12)
verify_backup (deps: 5, 18)
setup_local_dev_env (deps: 7)
configure_dast_tests (deps: 11)
create_helm_chart (deps: 17)
define_kustomize_overlay (deps: 17, 28)
configure_tilt_skaffold (deps: 26)
