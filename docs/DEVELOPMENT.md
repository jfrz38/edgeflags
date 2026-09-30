# EdgeFlags Development

This document defines the target developer experience. EdgeFlags has not reached
the bootstrap phase yet, so the commands and application paths below are not
available unless explicitly marked otherwise.

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
| Tests | Vitest | Phase 1 |
| Formatting and linting | Biome | Phase 1 |
| Storage | Cloudflare KV | Phase 3 |
| Infrastructure as code | Terraform | Phase 4 |
| Environment composition | Terragrunt | Phase 5 |
| Terraform linting | TFLint | Phase 6 or 16 |
| Security scanning | Trivy | Phase 6 or 16 |
| Load testing | k6 | Phase 14 |

Exact versions will be pinned when each tool is introduced. The JavaScript
package manager will be selected during project bootstrap and committed with its
lockfile.

## Target commands

The common task interface is expected to include:

```bash
mise install

mise run dev
mise run format
mise run lint
mise run typecheck
mise run test

mise run infra:fmt
mise run infra:validate
mise run infra:plan
mise run infra:apply

mise run load-test
```

Only add a documented command when it is executable. Until Phase 1 is complete,
these commands remain target examples.

GitHub Actions should call these repository tasks instead of maintaining a
second set of CI-only command sequences.

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
the Workers testing tools selected during implementation.

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
