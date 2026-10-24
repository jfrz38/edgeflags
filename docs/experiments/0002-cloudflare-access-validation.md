# EXP-0002: Cloudflare Access validation

- **Status:** Completed
- **Date:** 2026-10-16
- **Completed:** 2026-10-24
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

Remote authorization validation used a temporary second Service Token mapped
only to `flags:read`. It read a disposable flag successfully, received `403` for
write, evaluation, and deletion, and confirmed that the denied operations did
not change KV. The full-scope client then removed the flag. Deployment run
<https://github.com/jfrz38/edgeflags/actions/runs/40097383147> activated the
temporary Access policy, and run
<https://github.com/jfrz38/edgeflags/actions/runs/40097590029> restored the
single-client policy before the temporary Service Token was deleted.

The smoke-test Service Token was rotated while preserving an overlap in which
both secrets passed the remote lifecycle. GitHub and the local trusted client
adopted the replacement before deployment run
<https://github.com/jfrz38/edgeflags/actions/runs/40097776698> passed. A final
bounded rotation exercise repeated the overlap, deployment run
<https://github.com/jfrz38/edgeflags/actions/runs/40098148702> passed with the
replacement, and Access rejected the previous secret after its recorded
expiration while the replacement continued to pass.

The Service Token resource and Client Secret remain outside Terraform. Scans of
the exercised workflow logs found neither secret; GitHub masked the authorization
policy. Cloudflare's limits checked on 2026-10-24 allow 50 Service Tokens, and
the Access Free plan supports service-token authentication for a project well
below its 50-user limit.

## Conclusion

Cloudflare Access protects the development API while leaving health public. Its
non-identity Service Auth assertion provides a stable Client ID only after
signature, issuer, audience, lifetime, and algorithm verification. EdgeFlags
then applies its own fail-closed scopes independently from Access authentication.

The experiment demonstrated insufficient-scope denial without KV mutation and
credential rotation without interrupting the adopted client. The old secret was
subsequently rejected, the temporary validation token was removed, and no Client
Secret entered Terraform configuration, state-managed resources, or workflow
logs. The hypothesis is accepted for the development server-to-server flow.

## Limitations

- Local `ctx.access` simulation demonstrates application behavior, not the
  account's remote Access routing or identity-provider configuration.
- The remote exercise covered Service Auth clients. Human identity adaptation is
  automated-test coverage, not a remotely exercised identity-provider flow.
- The free-tier limits and provider identity shape are time-sensitive.

## Follow-up

- Carry the validated Access configuration into the controlled production
  delivery work.
- Revalidate provider behavior and limits before production activation.
