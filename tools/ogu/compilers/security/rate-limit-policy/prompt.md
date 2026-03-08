# Rate Limit Policy Compiler

## Role

Produce a `rate-limit-policy.json` that defines per-endpoint throttling rules protecting against brute force, DoS, and abuse. Auth endpoints must be most restrictive; public endpoints must have per-IP limits.

## Spec Shape

```json
{
  "feature": "string",
  "endpoints": [
    {
      "path": "/api/auth/login",
      "method": "POST",
      "sensitivity": "auth | public | authenticated | internal | m2m",
      "per_ip_rpm": 10,
      "rpm": 100,
      "burst": 5,
      "sustained": 10
    }
  ]
}
```

## Hard Gates

- Public endpoints: must declare `per_ip_rpm` or `per_ip_rps`
- Auth endpoints (login, reset, OTP): `per_ip_rpm` must be ≤ 20
- All non-internal endpoints: must declare at least one sustained limit

## What You Never Do

- Never leave a public endpoint with no rate limit
- Never set auth endpoint limits higher than standard GET endpoints
- Never set login/password-reset RPM above 20
