# ADR 0002: Manage Cloudflare infrastructure with Terraform

- **Status:** Accepted
- **Date:** 2026-10-08

## Context

Phase 4 needs reproducible Cloudflare resources without undocumented dashboard
steps. The project also needs to preserve fast local development, avoid putting
credentials or generated resource identifiers in Git, and keep one owner for
each remote resource.

Terraform and Wrangler can both create Workers resources. If both tools manage
the same resource, their state and configuration can drift. This iteration only
needs one development KV namespace and a manual Worker deployment; environment
composition and automated delivery belong to later phases.

## Decision

Use Terraform 1.16.5 and the Cloudflare provider 5.27.0 to manage the remote KV
namespace. Keep the initial module under `infra/modules/kv` and instantiate it
from `infra/live/dev`.

Wrangler remains the owner of Worker packaging and deployment. An ignored
Wrangler configuration is generated from the committed local configuration and
Terraform's namespace output immediately before deployment. Local development
continues to use Wrangler's local KV implementation and never falls back to the
remote namespace.

Keep Terraform state local for this learning iteration. State, plans, generated
Wrangler configuration, and credentials are excluded from Git. Mutable remote
operations remain explicit and are not part of routine validation.

## Alternatives considered

### Manage the Worker with Terraform

This could express the KV binding in one Terraform graph, but it would duplicate
Wrangler's existing ownership of bundling and deployment and make application
delivery part of the infrastructure state prematurely.

### Let Wrangler provision KV automatically

Wrangler can create a namespace while deploying, but that would not meet the
phase objective of reviewed, reproducible infrastructure managed as code.

### Introduce remote state now

Remote state is needed before shared or automated applies, but selecting and
operating a backend now would add credentials, cost, and lifecycle decisions
that this single-operator development iteration does not require.

## Consequences

### Positive

- The KV namespace has one declarative owner and a reviewable plan.
- Local execution cannot reach remote KV through the committed configuration.
- Worker deployment consumes the applied namespace ID without committing it.
- Terraform and provider versions are reproducible.

### Negative

- Local state must be protected and backed up by the operator.
- Deployment currently requires an explicit render step and local credentials.
- The state strategy must change before shared CI/CD applies are safe.

## Validation / experiments

- [x] Format and validate the Terraform configuration locally.
- [x] Review and apply a plan against a development Cloudflare account.
- [x] Exercise the deployed Worker against the provisioned KV namespace.
- [x] Confirm the development resources can be destroyed and recreated.

## Follow-up

- Select a shared state backend before automated or multi-operator applies.
- Add `prod` composition during the environments phase, not by copying this root.
- Move deployment orchestration into CI/CD only after its local workflow works.

Phase 5 implemented the environment-composition follow-up in
[ADR 0003](0003-compose-environments-with-terragrunt.md) without changing the
resource ownership or local-state decisions in this record.
