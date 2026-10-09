# ADR 0003: Compose environments with Terragrunt

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

Phase 5 needs distinct development and production inputs without copying a
Terraform root module. The existing development configuration also establishes
the future state address `module.flags_kv`, which should remain stable when the
composition changes. Cloudflare access is not currently available, so the
design must be locally verifiable without implying that a remote plan or apply
has succeeded.

## Decision

Pin Terragrunt 1.1.6 with mise. Keep Terraform resources in reusable modules and
introduce `infra/modules/environment` as the shared root module. Define one thin
`terragrunt.hcl` per environment containing only environment-specific inputs.

Generate an explicit local backend whose state path is
`infra/live/<environment>/terraform.tfstate`. This preserves the existing
development state location and the `module.flags_kv` resource address while
isolating production state. Continue supplying the operator-specific Cloudflare
account through `TF_VAR_cloudflare_account_id` rather than committing it as an
environment input.

Allow validation and plans for `dev` and `prod`. Keep apply, destroy, and Worker
deployment restricted to `dev` until controlled production delivery and shared
state are designed.

## Alternatives considered

### Copy the Terraform root into each environment

This avoids another tool but duplicates provider constraints, module wiring,
outputs, and backend policy. The copies would be likely to drift as more
resources are introduced.

### Use Terraform workspaces

Workspaces can separate state, but they make the selected environment less
visible in the repository and do not provide the desired composition layer for
later environment-specific dependencies.

### Introduce remote state now

Remote state is required before automation or multiple operators can apply
safely. Selecting and authenticating a backend without an available cloud
account would add an unvalidated dependency and does not improve this
single-operator local iteration.

## Consequences

### Positive

- Environment roots contain only their differing inputs.
- Development and production state cannot be mixed accidentally.
- Existing development state can remain at the same path and resource address.
- Both configurations can be formatted and validated without cloud credentials.

### Negative

- Terragrunt becomes another pinned tool contributors must install.
- Local state still requires operator backup and prevents safe shared applies.
- Provider lockfiles are retained per environment.
- Remote plans and free-tier eligibility remain unproven until account access is
  available.

## Validation / experiments

- [x] Format and validate Terragrunt HCL locally.
- [x] Initialize and validate Terraform for `dev` and `prod` locally.
- [ ] Review a `dev` plan against a suitable Cloudflare account.
- [ ] Recreate the development namespace through Terragrunt.
- [ ] Review a `prod` plan and confirm account-level free-tier usage.

## Follow-up

- Select a shared state backend before CI/CD or multi-operator applies.
- Add production mutation only with the Phase 7 approval and promotion model.
- Revalidate Cloudflare pricing and limits before the first remote apply.
