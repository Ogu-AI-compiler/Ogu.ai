
# Core Architecture

Core responsibilities:

- Workflow DAG engine
- Skill contracts
- Artifact validation
- Gate execution
- Retry + escalation
- Model routing integration

The core does NOT:

- Manage organization
- Manage UI
- Manage deployment infrastructure
- Hard-code any specific model provider

Core must be pure logic + state machine.
