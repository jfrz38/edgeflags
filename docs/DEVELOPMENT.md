# EdgeFlags Development

This document defines the developer experience. Phase 1 established the
application workflow; infrastructure and operational commands remain target
outcomes for later phases.

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
make format
make lint
make typecheck
make test
make pre-commit
make check
```

Infrastructure validation and load-testing tasks will be added by the phases
that introduce those capabilities. Only add a documented command when it is
executable.

Make is the public operational interface and delegates to the tool versions and
tasks managed by mise. GitHub Actions should call these Make targets instead of
maintaining a second set of CI-only command sequences.

`make install` also configures the Husky pre-commit hook. The hook delegates to
`make pre-commit`, which runs the fast lint check across the application. Hooks
provide local feedback but are not enforcement: contributors can skip them, so
the same checks must remain part of `make check` and future pull-request gates.

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

Variable names and setup instructions will be documented when their consuming
component is implemented. Example files must contain placeholders, never usable
credentials.

## Testing strategy

Tests are divided by the failure they are intended to detect.

### Unit tests

Vitest will cover pure behavior such as parsing, validation, flag evaluation,
rollout boundaries, deterministic assignment, and authorization decisions.

### Worker integration tests

Integration tests will exercise request handling and Cloudflare bindings using
the official `@cloudflare/vitest-plugin`. Wrangler generates runtime types from
the committed compatibility date before type-checking so the application types
match the configured Workers runtime.

### Infrastructure checks

Infrastructure validation will include the relevant subset of:

```text
terraform fmt
terraform validate
tflint
terragrunt plan
```

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
