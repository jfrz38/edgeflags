# EXP-0001: Cloudflare remote validation

- **Status:** Completed
- **Date:** 2026-10-15
- **Related phases:** Phases 4 and 5
- **Related issues:** None

## Hypothesis

The documented Terraform, Terragrunt, and Wrangler workflow can reproducibly
provision a development KV namespace, bind it to the Worker, and preserve the
same flag behavior demonstrated by local integration tests. The production
inputs should produce an isolated, reviewable plan without requiring an apply.

## Preconditions

- Repository commit `8bc74b2`.
- A Cloudflare account eligible for the documented Workers Free allowances.
- A locally supplied account identifier and API token with the permissions
  required to manage Workers KV and deploy the development Worker.
- Private local Terraform state for both environments.

## Procedure

1. Run `make infra-check`.
2. Run and review `make infra-plan ENV=dev` and `make infra-show ENV=dev`.
3. Apply the reviewed plan with `make infra-apply ENV=dev`.
4. Deploy the bound Worker with `make deploy-dev`.
5. Create, read, evaluate, replace, and delete a uniquely named disposable flag
   through the public endpoint.
6. Inspect the remote KV value and verify that its representation contains
   `version: 1`.
7. Destroy the development namespace, then repeat its plan, apply, deployment,
   and functional validation.
8. Run and review `make infra-plan ENV=prod` and `make infra-show ENV=prod`
   without applying the plan.

## Expected result

Development provisioning and deployment complete without dashboard changes, the
remote Worker matches the locally tested flag lifecycle, recreation preserves
the declared resource shape, and production proposes only its expected isolated
namespace within the documented free-tier inventory.

## Observations

- Development planning, apply, Worker deployment, and the complete disposable
  flag lifecycle succeeded.
- The stored KV value used the expected `version: 1` representation.
- Destroying and recreating development through the same commands succeeded, and
  the redeployed Worker passed the functional validation again.
- The production plan was reviewable, targeted the isolated production
  namespace, and was not applied.
- No undocumented Cloudflare dashboard step was required.

## Conclusion

The remote results support the Phase 4 and Phase 5 completion criteria. The
current manual workflow is reproducible for a single operator, and the
application-to-KV contract behaves consistently in local and deployed execution.

## Limitations

- State remains local and was available only to the operator who ran the test.
- Exact account, deployment, namespace, URL, request, and credential values are
  intentionally not stored in the repository.
- The experiment did not apply production infrastructure or deploy a production
  Worker.
- It did not measure cross-location propagation or stale reads.
- It did not exercise GitHub-hosted deployment or recovery from a failed apply.

## Follow-up

- Select and migrate to shared state before CI plans or automated applies.
- Define Phase 7 deployment triggers, environments, scoped credentials, smoke
  tests, and failure recovery.
- Measure propagation and stale-read behavior in Phase 15.
