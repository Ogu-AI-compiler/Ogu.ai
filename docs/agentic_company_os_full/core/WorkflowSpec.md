
# Workflow Definition Model

Each workflow is defined as:

- id
- steps
- dependencies
- requiredArtifacts
- requiredApprovals
- requiredGates

Example:

workflow: build_feature

steps:
  - pm_spec
  - architecture_review
  - backend_build
  - frontend_build
  - qa_validation
  - security_review
  - performance_review
  - release

Each step must output structured artifacts.
