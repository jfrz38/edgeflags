# EXP-0003: Production delivery validation

- **Status:** Planned
- **Date:** 2026-10-24
- **Related phase:** Phase 7
- **Related issues:** None

## Hypothesis

An approved promotion from `develop` to `main` can use isolated production
credentials and R2 state to apply the reviewed infrastructure, deploy a
Cloudflare Access-protected Worker, and pass a disposable authenticated flag
lifecycle without exceeding the current free allowances. The state lock and a
30-day backup should also provide a repeatable recovery path.

## Preconditions

- `make check` passes for the candidate commit.
- Current Workers, KV, R2, and Access pricing and account usage leave sufficient
  free allowance for the bounded validation.
- The production R2 bucket and independent plan, state, and backup credentials
  exist.
- `prod-plan` and approval-protected `prod` GitHub environments contain the
  variables and secrets documented in `DELIVERY.md`.
- A production-only Access Service Token exists outside Terraform state and is
  the only principal in `AUTHORIZATION_POLICY`.
- `PROD_R2_STATE_ENABLED=true`; `PROD_CD_ENABLED` remains false until the state
  exercises and pre-merge plan are reviewed.

## Procedure

1. Run a production plan from a pull request targeting `main` and review its
   action-count summary.
2. Start two bounded development plans concurrently against the same R2 state;
   confirm one owns the lock and the other cannot mutate state.
3. Back up development state, record its checksum and object key, restore that
   exact object in a controlled operator exercise, and confirm a new plan has no
   unexpected actions. Never perform this exercise through CI.
4. Confirm backup objects older than 30 days are removed and current state is
   never selected by retention.
5. Enable `PROD_CD_ENABLED`, merge the reviewed promotion to `main`, and approve
   the `prod` environment.
6. Confirm the workflow safely skips the pre-apply backup when no production
   state exists, applies its newly saved plan, and deploys `edgeflags-prod`.
7. Confirm health is public, an unauthenticated protected request returns `401`,
   and the production Service Token creates, reads, evaluates, and removes a
   disposable flag.
8. Rerun the production plan and confirm no unexpected drift.
9. Review account usage and record workflow links, timestamps, action counts, and
   sanitized observations without credentials or account identifiers.

## Expected result

The separate plan credential cannot mutate Cloudflare resources, production
requires explicit environment approval, state locking prevents concurrent
mutation, restoration returns state to the recorded checksum, and the first
deployment completes with Access enforced. The smoke flag is removed, a later
plan contains no unexpected changes, and measured usage remains within current
free allowances.

## Observations

Not run yet.

## Conclusion

Pending remote execution.

## Limitations

- A single production deployment does not demonstrate availability or capacity.
- R2, Workers, KV, Access, and GitHub plan capabilities are time-sensitive.
- The smoke test validates one Service Auth client, not human identity-provider
  access.

## Follow-up

- Mark Phase 7 complete only after recording the successful promotion and
  recovery evidence.
- Start Phase 9 abuse protection after Phase 7 completion.
