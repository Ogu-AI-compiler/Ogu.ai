
# Approval Workflow

Approval types:

- cross_boundary_change → CTO
- security_sensitive → CISO
- infra_change → DevOps
- major_release → CEO

Approval artifacts:

ApprovalRecord.json
{
  "approvedBy": "cto",
  "timestamp": "...",
  "decision": "approved"
}
