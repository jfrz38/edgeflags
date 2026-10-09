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
are required before CI/CD or multiple operators can apply infrastructure.

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
Actual traffic from both environments shares those allowances. This is a design
assessment, not account-backed proof: no Cloudflare account is currently
available to inspect plan eligibility, existing account consumption, or remote
behavior. Recheck the linked pricing and the target account before every first
environment apply.

## Commands

```bash
# No Cloudflare credentials required
make infra-check

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
