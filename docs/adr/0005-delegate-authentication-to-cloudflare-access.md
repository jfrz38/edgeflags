# ADR 0005: Delegate authentication to Cloudflare Access

- **Status:** Accepted
- **Date:** 2026-10-16

## Context

EdgeFlags must authenticate human operators and automated clients before a
production deployment can expose mutation operations. Implementing API-key
issuance, hashing, rotation, and revocation inside the Worker would duplicate an
identity capability already available in the selected Cloudflare platform.

Cloudflare Access can protect Worker paths before application code runs, exposes
authenticated identity through `ctx.access`, and supports expiring Service
Tokens for automation. The current free plan supports the project's bounded
learning usage. Access authenticates callers but cannot express EdgeFlags'
method-level flag permissions, so authorization remains an application concern.

Creating a Service Token with Terraform would write its one-time Client Secret
to Terraform state. Marking an output sensitive would hide terminal output but
would not remove the secret from state.

## Decision

Use Cloudflare Access to authenticate requests to `/flags/*` and `/evaluate/*`.
Keep the root health endpoint public. Human users authenticate through an Access
identity provider; automation uses an Access Service Token.

Translate `ctx.access` at the infrastructure boundary into an internal immutable
client identity. Resolve the following scopes from an environment-specific
Worker secret:

- `flags:read`,
- `flags:write`, and
- `flags:evaluate`.

Keep one shared flag namespace per environment. Authentication does not add user
ownership or multi-tenancy.

Manage Access applications and policies with Terraform. Create and rotate
Service Tokens through an explicit bootstrap command outside Terraform, then
store their credentials in the corresponding GitHub environment. Activation is
controlled by `ACCESS_ENABLED` so infrastructure and Worker enforcement change
together.

## Alternatives considered

### Application-managed API keys

This is portable and gives the application complete control, but adds credential
generation, secure verification, storage, rotation, and revocation that do not
advance the feature-flag domain.

### Store credentials in Workers KV

KV would make credentials dynamic, but eventual consistency is undesirable for
revocation and would mix authentication data with application storage.

### Issue application JWTs

This would require EdgeFlags to become an identity provider and manage signing
keys, refresh behavior, and revocation. Those responsibilities are outside the
project's goals.

### Manage Service Tokens with Terraform

This is reproducible, but the generated Client Secret is persisted in the R2
Terraform state. A controlled bootstrap preserves the stronger secret boundary.

## Consequences

### Positive

- Unauthenticated traffic is rejected before protected Worker code executes.
- Cloudflare manages login, Service Token expiration, rotation, and revocation.
- EdgeFlags retains explicit, testable operation scopes.
- No reusable client credential is stored in KV, Git, or Terraform state.

### Negative

- Authentication is coupled to Cloudflare Access.
- Access and GitHub environments require one-time account bootstrap.
- The application must fail closed if Access identity or authorization policy is
  missing while enforcement is active.
- Multiple Service Tokens may require a validated provider-specific identity
  field; until remote validation confirms it, the Access audience is the
  documented fallback identity for service authentication.

## Validation

The procedure and remote observations are tracked in
[EXP-0002](../experiments/0002-cloudflare-access-validation.md).
