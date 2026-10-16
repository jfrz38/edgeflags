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
    |-- root.hcl      # shared source and R2 backend policy
    |-- dev/          # development inputs
    `-- prod/         # production inputs
```

Both environments use the same modules and exact Terraform and provider
versions. Their committed differences are limited to environment inputs:

| Environment | KV namespace title | Mutable locally |
| --- | --- | --- |
| `dev` | `edgeflags-dev-flags` | Yes, with an explicit command |
| `prod` | `edgeflags-prod-flags` | No; validation and plan only |

Each environment can also compose a Cloudflare Access application for the
Worker's `/flags/*` and `/evaluate/*` paths. Access remains disabled unless
`ACCESS_ENABLED=true` and its hostname and bootstrap-created Service Token IDs
are supplied.

The Cloudflare account is selected at runtime with
`TF_VAR_cloudflare_account_id`. The API token is supplied with
`CLOUDFLARE_API_TOKEN`. Neither value belongs in committed Terragrunt files.

## State

Terragrunt generates an S3 backend that stores state in private Cloudflare R2.
Development and production use separate `edgeflags-terraform-state-dev` and
`edgeflags-terraform-state-prod` buckets, the common object key
`terraform.tfstate`, independent bucket-scoped credentials, and Terraform
lockfiles. The endpoint uses `CLOUDFLARE_ACCOUNT_ID`; R2 credentials use
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

Automated development backups use separate bucket-scoped S3 credentials exposed
as `R2_BACKUP_ACCESS_KEY_ID` and `R2_BACKUP_SECRET_ACCESS_KEY`. The backup upload
uses R2's S3-compatible API because bucket-scoped Object Read & Write tokens are
not supported by the Cloudflare REST API used by `wrangler r2 object put`.

The buckets are bootstrap resources: the environment root cannot create the
bucket required to initialize itself. `make infra-state-bootstrap ENV=dev|prod`
creates each bucket reproducibly with Wrangler. Creating R2 S3 credentials is a
separate Cloudflare account operation. Merging the configuration does not create
a bucket, credential, state object, or GitHub environment.

Access Service Tokens are also bootstrap credentials. They are intentionally not
Terraform resources because Cloudflare returns the Client Secret only once and
the provider would persist it in Terraform state. Terraform owns the Access
application and policies that reference the non-secret token resource IDs; GitHub
environment secrets hold the credentials used by smoke tests.

Before migration, `make infra-state-backup-local` copies development's ignored
local state into an ignored timestamped backup. `make infra-state-migrate` uses
Terraform's supported backend migration. Development state has been migrated;
clean GitHub runners now plan and deploy against R2. Lock and recovery exercises
remain documented hardening follow-up.

R2 does not provide the state-version history assumed by some S3 workflows.
`make infra-state-backup` therefore uploads the current development state to a
timestamped object under the bucket's `backups/` prefix. CD stops before planning
or applying if this backup fails. The state pull uses the backend credentials;
only the upload receives the dedicated backup credentials. Backup objects require
explicit retention.

## Credential-free tests

The shared Terraform root has native tests under
`infra/modules/environment/tests/`. They apply the development composition and
plan the production input variant with a mocked Cloudflare provider, verify the
namespace title and output wiring, and reject malformed account IDs. The mocked
namespace ID has the same shape expected from Cloudflare. The tests do not
contact Cloudflare or create remote resources.

`make worker-infra-test` passes that output shape through the same Wrangler
configuration generator used by `make deploy ENV=dev`. The generated `dev` binding
is then loaded by the official Cloudflare Vitest plugin, and the Worker performs
the complete flag lifecycle against Miniflare's isolated local KV. This proves
the local configuration contract and application wiring; it does not prove
Cloudflare authentication, remote state, deployment, or edge behavior.

## Remote validation

On 2026-10-15, the documented single-operator workflow was validated against a
Cloudflare account from repository commit `8bc74b2`:

1. The development plan was reviewed and applied through Terragrunt.
2. `make deploy ENV=dev` deployed the Worker with the provisioned `FLAGS_KV`
   binding.
3. A disposable flag was created, read, evaluated, replaced, and deleted through
   the public Worker endpoint.
4. Direct KV inspection confirmed the persisted representation used `version: 1`.
5. The development resources were destroyed, planned, applied, deployed, and
   exercised again successfully.
6. The production plan was reviewed and contained the expected isolated
   namespace; it was not applied.

This demonstrates remote wiring and reproducibility for the earlier manual
workflow. Deployment identifiers, account identifiers, credentials, and the
ephemeral test key are not committed. The experiment predates the later R2
migration and automated deployment validation. No cross-location consistency
claim follows from this validation. See [EXP-0001](experiments/0001-cloudflare-remote-validation.md)
for the recorded procedure and limitations.

## Free-tier inventory

The default desired remote inventory is two Workers KV namespaces, one for each
environment, plus one Worker deployment per environment. When activated, each
environment also has one Access application and a bounded set of policies;
Service Tokens are account bootstrap credentials rather than Terraform-managed
resources. Creating a namespace does not reserve a separate usage allowance:
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

Cloudflare's published R2 Standard free tier checked on 2026-10-15 includes 10
GB-month of storage, one million Class A operations, ten million Class B
operations, and free egress each month. Terraform state and bounded timestamped
backups are expected to use a negligible fraction of those allowances, but
backup retention must still be configured and usage observed. The free tier does
not apply to R2 Infrequent Access storage, so state buckets use Standard storage.
Source: [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Cloudflare Access Free limits checked on 2026-10-16 support up to 50 users, and
the current account limits document lists up to 50 Service Tokens. EdgeFlags
uses separate tokens for automated consumers, initially only the development
smoke test, and a small explicit operator set. Recheck these limits before
production activation.

The committed configuration provisions only two empty namespaces, so its static
inventory does not itself exceed the listed storage or operation allowances.
Actual traffic from both environments shares the Workers and KV allowances. The
development apply and production plan were reviewed against the target account
on 2026-10-15 and fit the listed allowances. Development R2 state and backups are
active; retention and measured usage remain follow-up. Recheck current pricing
and account consumption before every first environment apply.

## Commands

```bash
# No Cloudflare credentials required
make infra-check
make infra-test
make worker-infra-test

# One-time backend bootstrap; does not migrate state
make infra-state-bootstrap ENV=dev
make infra-state-bootstrap ENV=prod

# R2 and Cloudflare credentials required; ENV defaults to dev
make infra-init ENV=dev
make infra-plan ENV=dev
make infra-show ENV=dev
make infra-plan ENV=prod
make infra-show ENV=prod

# Development-only mutation and recovery preparation
make infra-state-backup-local ENV=dev
make infra-state-migrate ENV=dev
make infra-state-backup ENV=dev
make infra-apply ENV=dev
make infra-destroy ENV=dev

# Development Access bootstrap; run only from a trusted terminal
make access-token-create ENV=dev
make access-token-rotate ENV=dev
```

Saved plans, pre-migration local state, local backups, generated backends,
provider directories, and Terragrunt caches are ignored. Production apply,
destroy, deployment, and smoke tests are intentionally blocked by Make.

`make infra-check` includes `make infra-test`; the separate test target is useful
when iterating on the shared Terraform root. Pull request CI runs
`make infra-check` and reports the two desired KV namespaces in the GitHub job
summary. Once `R2_STATE_ENABLED=true` is configured, a protected `dev-plan` job
also creates an account-backed plan and emits only action counts. Infracost does
not price Cloudflare KV or R2 usage.
