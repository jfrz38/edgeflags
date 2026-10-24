# EdgeFlags Development

This document defines the developer experience for the application and the
currently implemented infrastructure workflow.

## Goals

The local workflow should be:

- reproducible from a clean clone,
- driven through the same task names in local development and CI,
- explicit about tool versions and required credentials, and
- able to validate application and infrastructure changes independently.

## Target repository structure

```text
.
|-- app/
|   |-- src/
|   |-- test/
|   |-- package.json
|   |-- tsconfig.json
|   `-- wrangler.toml
|-- infra/
|   |-- modules/
|   |   |-- worker/
|   |   |-- kv/
|   |   `-- observability/
|   `-- live/
|       |-- dev/
|       `-- prod/
|-- observability/
|   |-- dashboards/
|   |-- alerts/
|   `-- slo/
|-- load-tests/
|   `-- k6/
|-- docs/
|   |-- adr/
|   |-- ARCHITECTURE.md
|   |-- DELIVERY.md
|   |-- DEVELOPMENT.md
|   |-- EXPERIMENTS.md
|   `-- ROADMAP.md
|-- .github/
|   `-- workflows/
|-- .mise.toml
`-- README.md
```

This is an expected end-state, not a requirement to create empty directories at
bootstrap. Directories should be added by the phase that gives them a purpose.

## Toolchain

| Area | Target tool | Introduced in |
| --- | --- | --- |
| Runtime | TypeScript on Cloudflare Workers | Phase 1 |
| Local Worker development | Wrangler | Phase 1 |
| Tool versions and tasks | mise | Phase 1 |
| Operational task interface | GNU Make | Phase 1 |
| Local Git hooks | Husky | Phase 1 |
| Tests | Vitest | Phase 1 |
| Formatting and linting | Biome | Phase 1 |
| Architecture boundaries | Clean Architecture Highlighter CLI | Phase 2 |
| Storage | Cloudflare KV | Phase 3 |
| Infrastructure as code | Terraform | Phase 4 |
| Environment composition | Terragrunt | Phase 5 |
| Terraform linting | TFLint | Phase 6 or 16 |
| Security scanning | Trivy | Phase 6 or 16 |
| Load testing | k6 | Phase 14 |

The Phase 1 toolchain is pinned to:

| Tool | Version |
| --- | --- |
| GNU Make | 4.4.1 |
| Node.js | 24.21.0 |
| pnpm | 12.8.1 |
| TypeScript | 7.0.2 |
| Wrangler | 4.144.0 |
| Vitest | 4.1.11 |
| Cloudflare Vitest plugin | 1.3.3 |
| Biome | 2.5.14 |
| Husky | 9.1.7 |
| Clean Architecture Highlighter CLI | 0.1.0 |
| Terraform | 1.16.5 |
| Terragrunt | 1.1.6 |
| Cloudflare Terraform provider | 5.27.0 |

Direct dependencies use exact versions and `app/pnpm-lock.yaml` fixes the full
dependency graph. The pnpm configuration explicitly allows the installation
scripts required by `esbuild` and `workerd`; other dependency build scripts
remain blocked by default.

## Setup

Install the pinned tools and dependencies from the repository root:

```bash
mise install
make install
```

To run the local Worker with Access enforcement, copy the non-secret local test
configuration before `make dev`:

```bash
cp app/.dev.vars.example app/.dev.vars
```

The ignored file contains only a simulated local audience and test scopes. Never
copy remote Access credentials into it.

## Shared commands

The implemented application task interface is:

```bash
make help
make dev
make architecture
make format
make format-check
make lint
make typecheck
make test
make worker-infra-test
make security
make infra-init
make infra-format
make infra-validate
make infra-check
make infra-plan ENV=dev
make infra-plan ENV=prod
make access-validate ENV=dev BASE_URL=https://...
make pre-commit
make check
```

Mutable infrastructure and deployment commands are intentionally separate from
routine checks: `make infra-apply`, `make deploy ENV=dev`, and
`make infra-destroy`. `infra-apply` consumes the saved plan created by
`infra-plan`; `infra-destroy` remains interactive. Only run these commands after
reviewing the target account and expected changes.

Make is the public operational interface and delegates to tool versions managed
by mise. GitHub Actions should call these Make targets instead of
maintaining a second set of CI-only command sequences.

`make architecture` checks the implemented dependency direction: infrastructure
may depend on application and domain, application may depend on domain, and
domain remains independent. `make check` runs this check before formatting,
linting, type-checking, application tests, the local infrastructure-to-Worker
binding test, infrastructure checks, and security scanning. `make security`
uses the pinned Trivy version to reject fixable HIGH or CRITICAL dependency
vulnerabilities, detected secrets, and HIGH or CRITICAL infrastructure
misconfigurations.

`make install` also configures the Husky pre-commit hook. The hook delegates to
`make pre-commit`, which runs the fast lint check across the application. Hooks
provide local feedback but are not enforcement: contributors can skip them, so
the same checks must remain part of `make check` and future pull-request gates.

## Development infrastructure

Terraform configuration lives under `infra/`. The shared
`infra/modules/environment` root composes `infra/modules/kv` and optionally
`infra/modules/access`, and Terragrunt
instantiates it from `infra/live/dev` and `infra/live/prod`. Each environment has
its own namespace title and private R2 state bucket. Terraform owns the
namespaces; Wrangler owns Worker artifacts and deployment.

Set credentials in the process environment, never in committed `.tfvars` files:

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."
export TF_VAR_cloudflare_account_id="..."
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
```

A root `.env` file is ignored for operators who source these values into their
shell, but repository commands do not load it automatically. Never force-add it
to Git.

The Cloudflare token needs only the permissions required by the operation:
Workers KV namespace edits for Terraform, Access Apps and Policies edits when
Access is active, Worker script edits for deployment, or R2 object edits for
backup. R2 S3 access keys are separate credentials scoped to one state bucket.
The account identifier is not secret. Both account variables contain the same
value because the provider and backend consume different conventional names.

Validate both environments and create an environment-specific plan from the
repository root:

```bash
make infra-check
make infra-plan ENV=dev
make infra-show ENV=dev
make infra-plan ENV=prod
make infra-show ENV=prod
```

`ENV` defaults to `dev` and only accepts `dev` or `prod`. Remote operations also
require the R2 backend variables shown above. Plans are written as
ignored `edgeflags-<environment>.tfplan` files. Changes to code, inputs,
credentials, or state require a new plan. Applying and destroying infrastructure
are restricted to `ENV=dev`; production mutation remains blocked until API
security and controlled production delivery are available.

After reviewing the development plan, apply it explicitly:

```bash
make infra-apply ENV=dev
```

Terragrunt is configured for separate private R2 buckets. Before its first use,
follow the bootstrap and migration sequence in
[Infrastructure](INFRASTRUCTURE.md). The original local state, local backups,
saved plans, `.terraform/`, and `.terragrunt-cache/` remain ignored and private.
Remote plans and CD are active after the completed R2 migration. Do not set
`ACCESS_ENABLED=true` until the Access bootstrap below is complete.

After apply, deploy the Worker with the provisioned binding:

```bash
make deploy ENV=dev
```

The deployment target generates ignored `app/wrangler.dev.toml` from the local
Wrangler configuration and Terragrunt output, then deploys `edgeflags-dev` with
the `FLAGS_KV` binding. Do not edit or commit the generated file. This path does
not change `make dev`: local execution continues to use local KV and cannot fall
back to Cloudflare resources.

## Cloudflare Access development

Local Wrangler configuration simulates an authenticated Access application with
the `local-development` audience. Its committed authorization policy contains
only test scopes and is not a remote credential. Tests inject Access context at
the Worker boundary and cover missing identity, unknown principals, and
insufficient scopes.

For remote development, create a Service Token from a trusted terminal:

```bash
make access-token-create ENV=dev
```

The bootstrap `CLOUDFLARE_API_TOKEN` requires `Access: Service Tokens Write`.
This permission is not required by normal Worker traffic and should not be added
to the smoke-test Service Token.

Store the returned Client ID and Client Secret immediately in the GitHub `dev`
environment. Add the token resource ID to the comma-separated
`DEV_ACCESS_SERVICE_TOKEN_IDS` variable, store the Worker hostname as
`DEV_ACCESS_HOSTNAME`, store the Access organization issuer as
`DEV_ACCESS_ISSUER`, and store the identity-to-scope mapping as the
`AUTHORIZATION_POLICY` secret. The issuer is an HTTPS origin such as
`https://team.cloudflareaccess.com`. Never place a Client Secret in Terraform
inputs or state.

Cloudflare validates the Service Token Client ID and Client Secret before the
request reaches the Worker. Service Auth is a non-identity flow in remote
development, so the Worker verifies the signed `Cf-Access-Jwt-Assertion`
against the configured issuer and `ctx.access.aud`, then uses its `common_name`
Client ID as the stable application principal:

```json
{
  "service:<access-client-id>": [
    "flags:read",
    "flags:write",
    "flags:evaluate"
  ]
}
```

Configure the GitHub authorization policy, smoke-test secrets, and token ID list
before setting `ACCESS_ENABLED=true`. Each additional automated consumer gets a
separate Service Token, an entry in `DEV_ACCESS_SERVICE_TOKEN_IDS`, and its own
`service:<access-client-id>` authorization entry. The Access audience is never a
client identity and cannot grant scopes.

To validate authorization remotely without reducing the smoke-test client's
permissions, create a temporary second Service Token with a distinct name:

```bash
ACCESS_SERVICE_TOKEN_NAME=edgeflags-dev-read-validation \
  make access-token-create ENV=dev
```

Add its resource ID temporarily to the GitHub `dev` environment variable
`DEV_ACCESS_SERVICE_TOKEN_IDS`. Merge its Client ID into the existing
`AUTHORIZATION_POLICY` secret with only `flags:read`; do not remove the regular
smoke-test principal:

```json
{
  "service:<smoke-test-access-client-id>": [
    "flags:read",
    "flags:write",
    "flags:evaluate"
  ],
  "service:<limited-access-client-id>": ["flags:read"]
}
```

After deploying that policy, keep the regular smoke-test credentials in
`ACCESS_CLIENT_ID` and `ACCESS_CLIENT_SECRET`, export the temporary credentials
as `LIMITED_ACCESS_CLIENT_ID` and `LIMITED_ACCESS_CLIENT_SECRET`, and run:

```bash
make access-validate ENV=dev BASE_URL=https://...
```

The validation confirms that health remains public, an unauthenticated protected
request receives `401`, the limited client can read, write/evaluate/delete return
`403`, and denied operations do not change KV. It always attempts cleanup with
the full-scope client. Afterwards, delete the temporary Service Token, remove its
resource ID and authorization entry, and redeploy the restored configuration.

Human identities prefer `user:<user_uuid>`; `user:<verified-email>` is available
for initial bootstrap before the UUID has been recorded. Human identity takes
precedence over a supplied assertion. An unverified JWT, other provider fields,
and the Access audience alone do not grant scopes.

The first enabled deployment confirms Terraform's Access configuration and turns
on application enforcement. To rotate with a 24-hour overlap, run:

```bash
make access-token-rotate ENV=dev
```

Update GitHub with the replacement secret before the overlap expires.
Cloudflare revokes the previous secret at the configured timestamp. For an
emergency revocation, disable or delete the Service Token under Zero Trust
**Access controls > Service credentials**, then create a replacement before
reenabling automated deployment.

To remove the namespace after deleting any deployed Worker that consumes it:

```bash
make infra-destroy
```

## Local KV storage

Wrangler provides the `FLAGS_KV` binding declared in `app/wrangler.toml`.
`make dev` and the Worker integration tests use local KV storage and do not
require Cloudflare credentials or a remote namespace. The binding is explicitly
local and never falls back to a remote namespace.

Wrangler keeps local development state under the ignored `app/.wrangler/`
directory. To reset all local Wrangler state from the repository root, stop the
development server and run:

```bash
rm -rf app/.wrangler/state
```

Vitest isolates KV state between tests. Persistence adapter tests use the real
local Workers KV implementation rather than replacing it with an in-memory map.
`make worker-infra-test` also supplies a valid simulated Terraform output to the
deployment configuration generator, loads the generated `dev` configuration in
Miniflare, and runs the complete HTTP flag lifecycle against local KV. The
temporary configuration is removed after the test.

The generator also supports `make configure-worker ENV=prod` so its configuration
contract can be tested, but `make deploy ENV=prod` and `make smoke ENV=prod` are
rejected before they can contact Cloudflare.

### Remote validation

After applying development infrastructure and deploying the Worker, run
`make smoke ENV=dev BASE_URL=https://...`. When Access is active, export
`ACCESS_CLIENT_ID` and `ACCESS_CLIENT_SECRET` first. The automated check:

1. Verifies the root health response.
2. Creates a uniquely named disposable flag.
3. Reads and evaluates it with bounded retries for eventual consistency.
4. Removes it even when a later assertion fails.

Use a unique key such as `phase4-<UTC timestamp>`. Record the commit, account,
Worker deployment identifier, public URL, time, Terraform plan summary, and
observed responses without recording credentials. Use `wrangler kv key get`
against the namespace ID from
`terragrunt --working-dir infra/live/dev run --tf-path terraform -- output -raw
flags_kv_namespace_id` to
confirm the stored JSON has `version: 1`, then delete the disposable key through
the API. Eventual consistency may require bounded retries; it must not be
reported as a strong read-after-write guarantee.

This check proves remote wiring, not global consistency. Cross-location stale
read and propagation measurements belong to Phase 15.

## Configuration and secrets

Configuration must distinguish public identifiers from credentials:

| Configuration | Purpose | Secret |
| --- | --- | --- |
| Cloudflare account identifier | Account selection | No |
| Cloudflare API token | Infrastructure and deployment authentication | Yes |
| KV namespace and Worker binding names | Storage configuration | No |
| Access Service Token resource IDs, hostname, and issuer | Access and Worker security configuration | No |
| Access Client ID and Client Secret | Automated client authentication | Yes |
| Authorization policy | Internal identity-to-scope mapping | Yes |
| External telemetry credentials, if enabled | Observability export | Yes |

Local secrets should use mechanisms supported by Wrangler and mise. CI/CD
secrets should use GitHub environment or repository secrets with the narrowest
practical permissions.

Implemented infrastructure also uses `CLOUDFLARE_ACCOUNT_ID`,
`AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` for R2 state. CI maps separately
scoped GitHub environment secrets onto these conventional names. Example files
must contain placeholders, never usable credentials.

## Testing strategy

Tests are divided by the failure they are intended to detect.

### Unit tests

Vitest covers implemented pure behavior such as flag-key validation and use-case
decisions. Node's built-in test runner covers the Wrangler configuration
generator and its Terraform output boundary.

### Worker integration tests

Integration tests exercise request handling and local Cloudflare bindings using
the official `@cloudflare/vitest-plugin` and Miniflare. The binding contract test
loads a configuration produced by the same generator used for remote
development deployment. Wrangler generates runtime types from the committed
compatibility date before type-checking so application types match the configured
Workers runtime.

### Infrastructure checks

Infrastructure validation currently includes:

```text
terraform fmt
terraform validate
terraform test
terragrunt hcl validate
```

Native Terraform tests use a mocked Cloudflare provider to apply the development
composition, plan the production variant, verify outputs, and reject malformed
account IDs. They create no remote resources. Account-backed Terragrunt plans
remain a separate credentialed operation.

### Smoke tests

Deployment smoke tests will verify that the deployed Worker can read and
evaluate a known flag. They must be small, deterministic, and safe to repeat.

### Load and failure tests

k6 scenarios and controlled failures are separate from functional tests. Their
purpose is to measure latency, rate limiting, failure behavior, and operational
signals rather than to replace integration coverage.

## Documentation expectations

A change should update documentation when it changes:

- a user-visible command or prerequisite,
- the target or implemented architecture,
- an API or persisted contract,
- deployment or operational behavior,
- a roadmap completion criterion, or
- the status of an architectural decision or experiment.
