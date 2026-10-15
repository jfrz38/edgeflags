# ADR 0004: Store Terraform state in Cloudflare R2

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Automated plans and applies run on ephemeral GitHub-hosted runners. The local
backend selected in ADR 0002 and preserved by ADR 0003 cannot give those runners
the existing resource ownership record, coordinate concurrent operations, or
support multiple operators safely.

The project already uses Cloudflare and is intended to remain within documented
free allowances. Cloudflare R2 exposes an S3-compatible API and bucket-scoped
credentials, but compatibility with Terraform's S3 backend is best effort. R2
does not provide the S3 state-version history that Terraform users may otherwise
rely on, so recovery needs a separate backup policy.

The backend bucket must exist before Terraform can initialize the configuration
that uses it. Making the environment root create its own backend bucket would
therefore introduce a circular dependency.

## Decision

Use private Cloudflare R2 buckets through Terraform's S3 backend. Use one bucket
per environment:

- `edgeflags-terraform-state-dev`
- `edgeflags-terraform-state-prod`

Each bucket has independent R2 S3 credentials with object read and write access.
State uses the `terraform.tfstate` object key and Terraform's `use_lockfile`
support. Terragrunt obtains the Cloudflare account identifier from
`CLOUDFLARE_ACCOUNT_ID`; standard `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` variables supply backend credentials.

Create the buckets once through the documented `make infra-state-bootstrap`
command rather than through the environment Terraform root or an undocumented
Dashboard step. Creating bucket credentials remains an explicit Cloudflare
account bootstrap operation.

Before migrating development, preserve the local state with
`make infra-state-backup-local`. Migrate it with Terraform's supported
`init -migrate-state` operation, then verify a no-recreation plan from a clean
checkout. Before each automated development apply, copy the current state to a
timestamped `backups/` object in the same environment bucket. Recovery is an
explicit operator action; CI never pushes or edits state manually.

Pull-request plans and development deployments remain disabled until the state
migration, lock test, GitHub environments, and credentials are complete.
Production state and credentials remain isolated, and production apply stays
blocked until the production delivery policy is activated.

This decision supersedes only the local-backend portions of ADR 0002 and ADR
0003. Terraform still owns KV namespaces, Wrangler still owns Worker deployment,
and Terragrunt still composes environments.

## Alternatives considered

### Keep local state

This avoids another remote service but cannot support accurate plans or safe
applies from ephemeral GitHub runners.

### Store both environments in one R2 bucket

Separate object keys would prevent accidental state-file overlap but would not
provide a useful bucket-level credential boundary. Separate buckets keep
development credentials from reading or modifying production state.

### Create the R2 buckets with the environment Terraform root

Terraform cannot initialize an R2 backend before that bucket exists. A separate
Terraform bootstrap state would move rather than remove the bootstrap problem
and add another state lifecycle for two stable buckets.

### Use Workers KV as a backend

Workers KV is application storage with eventual consistency. It does not
implement Terraform's backend or locking contract and must not become the source
of truth for infrastructure ownership.

## Consequences

### Positive

- Ephemeral runners and operators share the same infrastructure ownership record.
- Development and production have independent credential and failure boundaries.
- Terraform can serialize operations with a state lockfile.
- State storage remains in the existing Cloudflare account and expected free tier.

### Negative

- R2 buckets and credentials require a one-time bootstrap outside Terraform.
- S3 compatibility and lock behavior must be tested before enabling automated apply.
- R2 state history requires explicit backup objects and retention maintenance.
- Backend and state-backup credentials add rotation and recovery responsibilities.
- Free allowances and provider behavior can change and require revalidation.

## Validation / experiments

- [ ] Create both private R2 buckets and bucket-scoped credentials.
- [ ] Migrate the existing development state after preserving a private backup.
- [ ] Verify a clean runner does not plan to recreate the development namespace.
- [ ] Verify two concurrent operations cannot mutate the same state.
- [ ] Restore a copied state object in a controlled recovery exercise.
- [ ] Confirm the expected state and backup usage remains within the R2 free tier.

## Follow-up

- Configure protected `dev-plan` and `dev` GitHub environments.
- Enable remote plans only after migration by setting `R2_STATE_ENABLED=true`.
- Enable development CD only after a successful lock and recovery exercise by
  setting `DEV_CD_ENABLED=true`.
- Define retention for objects under each bucket's `backups/` prefix.
- Keep production apply and deployment disabled until API authentication exists.
