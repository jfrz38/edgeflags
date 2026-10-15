# EdgeFlags Infrastructure

Terraform owns Cloudflare resources and Wrangler owns Worker packaging and
deployment. Terragrunt provides the environment composition layer.

## Layout

```text
infra/
|-- modules/
|   |-- environment/  # shared Terraform root
|   `-- kv/           # reusable KV namespace
`-- live/
    |-- root.hcl      # shared source and backend policy
    |-- dev/          # development inputs and state
    `-- prod/         # production inputs and state
```

Both environments use the same modules and exact Terraform and provider
versions. Their committed differences are limited to environment inputs:

| Environment | KV namespace title | Mutable locally |
| --- | --- | --- |
| `dev` | `edgeflags-dev-flags` | Yes, with an explicit command |
| `prod` | `edgeflags-prod-flags` | No; validation and plan only |

The Cloudflare account is selected at runtime with
`TF_VAR_cloudflare_account_id`. The API token is supplied with
`CLOUDFLARE_API_TOKEN`. Neither value belongs in committed Terragrunt files.

## State

Terragrunt generates a local backend for each environment. State remains at
`infra/live/<environment>/terraform.tfstate`, outside the generated cache. This
keeps the earlier development state location and resource address intact while
preventing development and production state from sharing a file.

Local state is suitable only for the current single-operator learning workflow.
It must be kept private and backed up. A shared backend and migration procedure
are required before CI can publish remote plans or CD and multiple operators can
apply infrastructure.

Pull request CI therefore does not run a remote plan. An ephemeral runner cannot
access this local state and would report every configured resource as a create,
which is not a reviewable representation of the real change.

## Credential-free tests

The shared Terraform root has native tests under
`infra/modules/environment/tests/`. They apply the development composition and
plan the production input variant with a mocked Cloudflare provider, verify the
namespace title and output wiring, and reject malformed account IDs. The mocked
namespace ID has the same shape expected from Cloudflare. The tests do not
contact Cloudflare or create remote resources.

`make worker-infra-test` passes that output shape through the same Wrangler
configuration generator used by `make deploy-dev`. The generated `dev` binding
is then loaded by the official Cloudflare Vitest plugin, and the Worker performs
the complete flag lifecycle against Miniflare's isolated local KV. This proves
the local configuration contract and application wiring; it does not prove
Cloudflare authentication, remote state, deployment, or edge behavior.

## Remote validation

On 2026-10-15, the documented single-operator workflow was validated against a
Cloudflare account from repository commit `8bc74b2`:

1. The development plan was reviewed and applied through Terragrunt.
2. `make deploy-dev` deployed the Worker with the provisioned `FLAGS_KV`
   binding.
3. A disposable flag was created, read, evaluated, replaced, and deleted through
   the public Worker endpoint.
4. Direct KV inspection confirmed the persisted representation used `version: 1`.
5. The development resources were destroyed, planned, applied, deployed, and
   exercised again successfully.
6. The production plan was reviewed and contained the expected isolated
   namespace; it was not applied.

This demonstrates remote wiring and reproducibility for the current manual
workflow. Deployment identifiers, account identifiers, credentials, and the
ephemeral test key are not committed. Local state still prevents safe CI plans
or multi-operator applies, and no cross-location consistency claim follows from
this validation. See [EXP-0001](experiments/0001-cloudflare-remote-validation.md)
for the recorded procedure and limitations.

## Free-tier inventory

The default desired remote inventory is two Workers KV namespaces, one for each
environment, plus one Worker deployment per environment when delivery is
implemented. Creating a namespace does not reserve a separate usage allowance:
Workers and KV limits are aggregated at the Cloudflare account plan level.

Cloudflare's published Workers Free limits checked on 2026-10-09 include:

| Meter | Account-level free allowance |
| --- | --- |
| Worker requests | 100,000 per day |
| Worker CPU | 10 ms per invocation |
| KV reads | 100,000 keys per day |
| KV writes | 1,000 keys per day |
| KV deletes | 1,000 keys per day |
| KV list requests | 1,000 per day |
| KV storage | 1 GB |

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
and [Workers KV pricing](https://developers.cloudflare.com/kv/platform/pricing/).
Cloudflare states that free KV operation limits reset daily at 00:00 UTC and
further operations of an exhausted type fail.

The committed configuration provisions only two empty namespaces, so its static
inventory does not itself exceed the listed storage or operation allowances.
Actual traffic from both environments shares those allowances. The development
apply and production plan were reviewed against the target account on 2026-10-15
and fit the listed free allowances. Recheck current pricing and account
consumption before every first environment apply.

## Commands

```bash
# No Cloudflare credentials required
make infra-check
make infra-test
make worker-infra-test

# Credentials required; ENV defaults to dev
make infra-plan ENV=dev
make infra-show ENV=dev
make infra-plan ENV=prod
make infra-show ENV=prod

# Development only
make infra-apply ENV=dev
make infra-destroy ENV=dev
```

Saved plans, local state, generated backends, provider directories, and
Terragrunt caches are ignored. Production apply and destroy are intentionally
blocked by the Make interface.

`make infra-check` includes `make infra-test`; the separate test target is useful
when iterating on the shared Terraform root. Pull request CI runs
`make infra-check` and reports the two desired KV namespaces in the GitHub job
summary. This inventory is not an account-backed plan or cost estimate.
