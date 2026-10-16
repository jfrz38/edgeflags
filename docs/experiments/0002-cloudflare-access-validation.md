# EXP-0002: Cloudflare Access validation

- **Status:** Planned
- **Date:** 2026-10-16
- **Related phase:** Phase 8
- **Related issues:** None

## Hypothesis

Cloudflare Access can protect the development flag API, expose a stable identity
for human and Service Token requests, and rotate the smoke-test credential
without interrupting deployment while remaining inside the documented free
tier.

## Preconditions

- The development Worker and R2-backed Terraform state are operational.
- Zero Trust is enabled for the Cloudflare account.
- An Access Service Token has been created outside Terraform state.
- The Access variables and GitHub `dev` secrets documented in
  [DELIVERY.md](../DELIVERY.md) are configured.
- The candidate commit passes `make check` with Access enforcement enabled in
  local tests.

## Procedure

1. Apply the development plan with `ACCESS_ENABLED=true` and review the Access
   application paths and policies.
2. Confirm an unauthenticated request to `/flags/test` is rejected by Access.
3. Confirm `GET /` remains public.
4. Configure `service:<access-client-id>` for the Service Token and call the
   protected API. Confirm that `ctx.access` exposes the Client ID through
   `service_token_id`. Record only whether the expected identity shape succeeds,
   without recording credentials or personal data.
5. Exercise each scope and verify that an insufficient scope returns `403`
   without changing KV.
6. Run the authenticated remote smoke test.
7. Rotate the Service Token with a 24-hour overlap, update GitHub, and rerun the
   deployment.
8. After the overlap expires, confirm that only the replacement secret succeeds.
9. Review Access usage and current plan limits.

## Expected result

Access rejects unauthenticated protected requests before Worker business logic,
EdgeFlags enforces method-level scopes for authenticated callers, the smoke test
survives credential rotation, and no Client Secret appears in Terraform state or
workflow output.

## Observations

Pending remote activation.

## Conclusion

Pending.

## Limitations

- Local `ctx.access` simulation demonstrates application behavior, not the
  account's remote Access routing or identity-provider configuration.
- The free-tier limits and provider identity shape are time-sensitive.

## Follow-up

- Record remote run links and sanitized observations.
- Update ADR 0005 if the documented `service_token_id` identity is unavailable
  or requires signed JWT validation.
- Enable production Access only after development validation succeeds.
