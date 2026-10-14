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

## Shared commands

The implemented application task interface is:

```bash
make help
make dev
make architecture
make format
make lint
make typecheck
make test
make worker-infra-test
make infra-init
make infra-format
make infra-validate
make infra-check
make infra-plan ENV=dev
make infra-plan ENV=prod
make pre-commit
make check
```

Mutable infrastructure and deployment commands are intentionally separate from
routine checks: `make infra-apply`, `make deploy-dev`, and
`make infra-destroy`. `infra-apply` consumes the saved plan created by
`infra-plan`; `infra-destroy` remains interactive. Only run these commands after
reviewing the target account and expected changes.

Make is the public operational interface and delegates to tool versions managed
by mise. GitHub Actions should call these Make targets instead of
maintaining a second set of CI-only command sequences.

`make architecture` checks the implemented dependency direction: infrastructure
may depend on application and domain, application may depend on domain, and
domain remains independent. `make check` runs this check before linting,
type-checking, application tests, the local infrastructure-to-Worker binding
test, and infrastructure checks.

`make install` also configures the Husky pre-commit hook. The hook delegates to
`make pre-commit`, which runs the fast lint check across the application. Hooks
provide local feedback but are not enforcement: contributors can skip them, so
the same checks must remain part of `make check` and future pull-request gates.

## Development infrastructure

Terraform configuration lives under `infra/`. The shared
`infra/modules/environment` root composes `infra/modules/kv`, and Terragrunt
instantiates it from `infra/live/dev` and `infra/live/prod`. Each environment has
its own namespace title and local state. Terraform owns the namespaces; Wrangler
owns Worker artifacts and deployment.

Set credentials in the process environment, never in committed `.tfvars` files:

```bash
export CLOUDFLARE_API_TOKEN="..."
export TF_VAR_cloudflare_account_id="..."
```

The token needs the smallest account-scoped permissions that allow Workers KV
namespace edits for the selected development account. Wrangler also needs
permission to deploy Workers scripts. The account identifier is not secret, but
using an environment variable avoids committing operator-specific values.

Validate both environments and create an environment-specific plan from the
repository root:

```bash
make infra-check
make infra-plan ENV=dev
make infra-show ENV=dev
make infra-plan ENV=prod
make infra-show ENV=prod
```

`ENV` defaults to `dev` and only accepts `dev` or `prod`. Plans are written as
ignored `edgeflags-<environment>.tfplan` files. Changes to code, inputs,
credentials, or state require a new plan. Applying and destroying infrastructure
are currently restricted to `ENV=dev`; production mutation is deferred to the
controlled delivery work in Phase 7.

After reviewing the development plan, apply it explicitly:

```bash
make infra-apply ENV=dev
```

This iteration deliberately uses separate local Terraform state files at
`infra/live/<environment>/terraform.tfstate`. Files matching `*.tfstate`, saved
plans, `.terraform/`, and `.terragrunt-cache/` are ignored. The operator must
keep state private and backed up because losing it breaks Terraform's ownership
record. A shared backend must be selected before multi-operator or automated
applies. See [Infrastructure](INFRASTRUCTURE.md) for composition and free-tier
details.

After apply, deploy the Worker with the provisioned binding:

```bash
make deploy-dev
```

The deployment target generates ignored `app/wrangler.dev.toml` from the local
Wrangler configuration and Terragrunt output, then deploys `edgeflags-dev` with
the `FLAGS_KV` binding. Do not edit or commit the generated file. This path does
not change `make dev`: local execution continues to use local KV and cannot fall
back to Cloudflare resources.

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

### Remote validation

After applying the development namespace and deploying the Worker:

1. Deploy the same Worker code with `FLAGS_KV` bound to that namespace.
2. Create, read, evaluate, replace, and delete a uniquely named disposable flag.
3. Confirm persisted values use the documented versioned representation without
   exposing credentials or values through Terraform outputs.
4. Record the account, environment, deployment identifier, time, and observed
   result.
5. Remove the disposable flag.

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
| API credential hashing secret, if selected | Credential protection | Yes |
| External telemetry credentials, if enabled | Observability export | Yes |

Local secrets should use mechanisms supported by Wrangler and mise. CI/CD
secrets should use GitHub environment or repository secrets with the narrowest
practical permissions.

Implemented infrastructure uses `CLOUDFLARE_API_TOKEN` and
`TF_VAR_cloudflare_account_id`. Future variable names will be documented when
their consuming component is implemented. Example files must contain
placeholders, never usable credentials.

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
