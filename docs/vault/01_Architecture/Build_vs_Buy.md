# Build vs Buy

Decision framework for choosing between building in-house and using an external service.
Ogu must consult this document whenever a feature touches a sensitive category.

## Sensitive Categories

These categories always require evaluation before implementation:

| Category | Default | Reason |
|----------|---------|--------|
| Payments | External (Stripe) | Compliance, PCI, complexity |
| Auth / SSO | External or proven library | Security critical |
| Email / SMS | External | Deliverability, reputation |
| Video | External (Mux, Cloudflare Stream) | Encoding pipeline is a bottomless pit |
| Search | Internal first (Postgres) | Upgrade to external when scale demands |
| Storage | External (S3-compatible) | Commodity, cheap, reliable |
| Maps | External | Commodity |
| Chat / Realtime | Evaluate | Depends on how central it is |
| AI / ML inference | External API | Unless model is the product |
| Analytics | External first | Build internal only for core product metrics |

## Decision Criteria

Score each criterion 1-5 for the feature in question:

| Criterion | 1 (low) | 5 (high) | Tendency when high |
|-----------|---------|----------|-------------------|
| Differentiation | Generic commodity | Core product value | Build internal |
| Complexity | Simple to implement | Deep domain expertise needed | Buy external |
| Compliance risk | No sensitive data | PCI/HIPAA/GDPR critical | Buy proven, or build with full control |
| SLA criticality | Nice to have | System is dead without it | Buy if you can't match SLA |
| Cost sensitivity | Budget flexible | Every dollar counts | Evaluate both, pick cheaper |
| Lock-in risk | Easy to switch | Deeply embedded, hard to leave | Build or choose portable |
| Team capability | Team has deep expertise | No one knows this domain | Buy |

## Decision Rules

1. **High differentiation** → build internal, unless complexity or compliance are extreme
2. **Low differentiation + high complexity** → external service
3. **High compliance risk** → never decide without ADR. Either use battle-tested external or build with full audit trail
4. **Any sensitive category** → ADR is mandatory

## Required Output

When evaluating build vs buy, produce:

### Decision Matrix

```
Feature: <name>
Category: <from sensitive categories>

Differentiation:  [1-5]
Complexity:       [1-5]
Compliance:       [1-5]
SLA criticality:  [1-5]
Cost sensitivity:  [1-5]
Lock-in risk:     [1-5]

Decision: BUILD / BUY <provider>
```

### Abstraction Requirement

Even when buying, always create an abstraction interface:

```typescript
// In application or domain layer
interface EmailProvider {
  send(to: string, template: string, data: Record<string, unknown>): Promise<void>
}
```

Implementation in infrastructure:

```typescript
// SendGrid adapter
class SendGridEmailProvider implements EmailProvider { ... }

// Mock adapter for dev/test
class MockEmailProvider implements EmailProvider { ... }
```

This ensures:
- Provider can be swapped without touching business logic
- Tests run without external dependencies
- Mock API works without real services

### ADR

For any sensitive category, create an ADR:

```bash
node tools/ogu/cli.mjs adr "<decision title>" \
  --context "<why this decision is needed>" \
  --decision "<what was chosen and why>" \
  --alternatives "<what else was considered>"
```

The ADR must include an **exit strategy**: what happens if you need to switch providers.

## Anti-Patterns

- Choosing a service "because everyone uses it" without evaluating criteria
- Building in-house "because we can" when complexity is high and differentiation is low
- Using an external service without an abstraction layer
- No exit strategy documented
- Deciding without ADR for sensitive categories
