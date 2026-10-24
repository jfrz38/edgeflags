# EXP-0002: Cloudflare Access validation

- **Status:** In progress
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
   protected API. Confirm how Service Auth exposes the authenticated client at
   the Worker boundary. Record only the identity shape, without recording
   credentials or personal data.
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

Development activation on 2026-10-19 confirmed that Access rejects unauthenticated
protected requests while leaving `GET /` public. Access accepted the configured
Service Token and recorded it as a `nonidentity` connection, but
`ctx.access.getIdentity()` did not expose `service_token_id` for that request.
The initial adapter therefore rejected the authenticated smoke test with `403`.

The application token identified the authenticated Service Token by Client ID,
but the credential Client ID header was not available to the Worker after Access
processed the request. The adapter must instead verify the
`Cf-Access-Jwt-Assertion` signature, issuer, audience, lifetime, and algorithm
before using its `common_name` claim.

The adapted Service Auth flow passed an authenticated remote flag lifecycle on
2026-10-19 and again in the automatic development deployment for commit
`c21d88f` on 2026-10-24. The latter run is recorded at
<https://github.com/jfrz38/edgeflags/actions/runs/40053449412>. A direct check on
2026-10-24 also confirmed that `GET /` returned the public health response with
`200`, while an unauthenticated request to `/flags/access-validation` returned
`401` before a Worker JSON response.

Remote insufficient-scope validation and Service Token rotation remain pending.

## Conclusion

Pending.

## Limitations

- Local `ctx.access` simulation demonstrates application behavior, not the
  account's remote Access routing or identity-provider configuration.
- The free-tier limits and provider identity shape are time-sensitive.

## Follow-up

- Record remote run links and sanitized observations.
- Rerun the authenticated smoke test after adapting the non-identity Service Auth
  flow.
- Enable production Access only after development validation succeeds.
