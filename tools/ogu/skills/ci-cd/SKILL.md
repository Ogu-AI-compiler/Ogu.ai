---
name: ci-cd
description: Designs and implements CI/CD pipelines for automated build, test, and deployment workflows. Use when setting up new pipelines, improving deployment automation, or reducing time from commit to production. Triggers: "CI/CD", "build pipeline", "GitHub Actions", "Jenkins", "automated deployment", "deployment pipeline".
---

# CI/CD

## When to Use
- Setting up CI/CD for a new service or repository
- Improving an existing pipeline that is slow or unreliable
- Automating the deployment of a service that is deployed manually

## Workflow
1. Build stage: compile, lint, and run fast unit tests (target < 3 minutes)
2. Test stage: run integration tests and security scans in parallel
3. Artifact stage: build and push Docker image; tag with commit SHA
4. Deploy stage: use blue/green or rolling deployment; automated smoke tests post-deploy
5. Rollback: automated trigger on smoke test failure; manual trigger always available

## Quality Bar
- Full pipeline completes in under 15 minutes for fast feedback
- Deployments are automated from merge to production (with approval gate for prod)
- Pipeline is defined as code (GitHub Actions YAML, Jenkinsfile) stored in the repo
- Every failed pipeline run produces clear, actionable error output
