# Kubernetes Specialty Addendum

## Core Concepts
- Pod is the atomic unit. One container per pod unless containers share lifecycle.
- Deployments for stateless workloads. StatefulSets for databases and ordered services.
- Services for stable networking: ClusterIP (internal), LoadBalancer (external), NodePort (dev).
- ConfigMaps for configuration. Secrets for sensitive data (base64, not encrypted by default).
- Namespaces for environment isolation: dev, staging, production.

## Resource Management
- Always set resource requests AND limits for every container.
- Requests: guaranteed resources. Set to actual steady-state usage.
- Limits: maximum allowed. Set to 2x requests for burst capacity.
- LimitRange: enforce defaults at namespace level.
- ResourceQuota: prevent namespace from consuming entire cluster.
- CPU: 1000m = 1 core. Start with 100m-500m for typical web services.
- Memory: request == limit to avoid OOM kills. Measure actual usage first.

## Health Checks
- Liveness probe: is the process alive? Restart if failed. HTTP GET /healthz.
- Readiness probe: can it serve traffic? Remove from service if failed. HTTP GET /readyz.
- Startup probe: for slow-starting apps. Prevents premature liveness failures.
- Probe configuration: initialDelaySeconds, periodSeconds, failureThreshold.
- Never make liveness depend on external services (database, cache).

## Scaling
- HorizontalPodAutoscaler (HPA): scale on CPU, memory, or custom metrics.
- KEDA for event-driven scaling (queue depth, request rate, cron).
- Cluster Autoscaler: add/remove nodes based on pending pods.
- PodDisruptionBudget: ensure minimum available pods during updates.
- Scale-down stabilization: prevent thrashing with `--horizontal-pod-autoscaler-downscale-stabilization`.

## Networking
- NetworkPolicy: deny all by default, allow specific ingress/egress.
- Ingress controller: NGINX or Envoy for HTTP routing, TLS termination.
- Service mesh (Istio/Linkerd): mutual TLS, traffic management, observability.
- DNS: `service.namespace.svc.cluster.local` for inter-service communication.
- Pod-to-pod communication: use service names, never pod IPs.

## Security
- RBAC: least privilege for service accounts. No cluster-admin in production.
- Pod Security Standards: restricted mode for production namespaces.
- Image policy: only allow images from trusted registries.
- Secret encryption at rest: enable EncryptionConfiguration for etcd.
- Network policies: default deny, explicit allow for each service.

## Deployment Strategy
- Rolling update: default. Set maxSurge and maxUnavailable.
- Blue-green: two deployments, switch service selector.
- Canary: use service mesh or ingress annotations for traffic splitting.
- Rollback: `kubectl rollout undo` or GitOps reconciliation.

## Debugging
- `kubectl describe pod` for events and scheduling failures.
- `kubectl logs -f --previous` for crashed container logs.
- `kubectl exec -it` for interactive debugging (temporary, not production habit).
- `kubectl top pods` for resource usage. Compare to requests/limits.
- Events: `kubectl get events --sort-by=.metadata.creationTimestamp`.

<!-- skills: kubernetes, container-orchestration, helm, scaling, networking, security-k8s, monitoring, service-mesh, resource-management, deployment-strategy -->
