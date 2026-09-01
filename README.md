# EdgeFlags

A lightweight feature flag service built with TypeScript, Cloudflare Workers, KV, Terraform/Terragrunt, and observability tooling for experimentation and testing.

> [!IMPORTANT]
> This project is a learning playground.
>
> It is intentionally designed to experiment with infrastructure, observability, security, CI/CD, and SRE practices around a very simple domain.
>
> It is **not intended to be used as a production-ready feature flag platform**.

## Current status

EdgeFlags is currently in the **design/bootstrap phase**.

The repository intentionally starts with the architecture, learning goals, constraints, and roadmap documented before implementation begins. Commands and repository paths described below represent the target developer experience and will become executable as each phase lands.

## Goals

The main goal of this repository is not to build a complete feature flag product.

Instead, the feature flag domain is used as a simple excuse to experiment with technologies and engineering practices such as:

- Cloudflare Workers
- Cloudflare KV
- TypeScript
- OpenFeature
- Terraform
- Terragrunt
- mise
- GitHub Actions
- Infrastructure as Code
- API keys and authorization
- Rate limiting
- OpenTelemetry
- Grafana
- Logs, metrics, and traces
- SLI/SLO definitions
- Load testing with k6
- Infrastructure and dependency security scanning
- Architecture Decision Records (ADRs)

## Constraints

The project should remain intentionally small and inexpensive to operate.

### Free-tier first

The default development and deployed environments should use **free tiers only** whenever possible.

If a planned capability requires a paid plan, it should either:

1. have a free-tier-compatible alternative,
2. remain an optional experiment, or
3. be documented but not enabled by default.

This constraint is part of the learning exercise: architecture decisions should account for platform pricing and service limits rather than assuming unlimited infrastructure.

## Architecture

```text
                       ┌──────────────────────┐
                       │       Client         │
                       └──────────┬───────────┘
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │     Cloudflare       │
                       │                      │
                       │  TLS / Edge          │
                       │  Rate limiting       │
                       └──────────┬───────────┘
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │ TypeScript Worker    │
                       │                      │
                       │ Authentication       │
                       │ Authorization        │
                       │ Flag evaluation      │
                       └──────────┬───────────┘
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │   Cloudflare KV      │
                       │                      │
                       │   Feature flags      │
                       └──────────────────────┘

                                  │
                                  │ telemetry
                                  ▼
                       ┌──────────────────────┐
                       │ Observability stack  │
                       │                      │
                       │ Grafana / SRE        │
                       │ free-tier path TBD   │
                       └──────────────────────┘
```

The observability path is intentionally left implementation-specific for now. Cloudflare Workers can export OpenTelemetry logs and traces to external OTLP destinations, but direct OTel export is not currently available on the Workers Free plan, and Worker/custom metrics are not currently exportable through that mechanism. The project will therefore evaluate a free-tier-compatible observability path before enabling external telemetry by default.

## Feature flags

The initial implementation will support simple boolean feature flags.

Example:

```json
{
  "key": "new-checkout",
  "enabled": true
}
```

The project may later evolve to support:

- Percentage rollouts
- User targeting
- Environments
- Context-based rules
- Application version targeting
- Country targeting
- Multiple flag value types

Example percentage rollout:

```json
{
  "key": "new-checkout",
  "enabled": true,
  "rollout": 25
}
```

Rollouts should be deterministic so the same user consistently receives the same result.

Conceptually:

```text
hash(flagKey + userId) % 100 < rollout
```

## OpenFeature

EdgeFlags will explore interoperability with [OpenFeature](https://openfeature.dev/), a vendor-neutral specification for feature flag evaluation.

The goal is not to force OpenFeature into the first implementation, but to use the project to understand:

- Evaluation context
- Typed flag values
- Resolution details
- Provider responsibilities
- Hooks and events
- Remote evaluation through OFREP

A later phase may expose an OpenFeature-compatible integration or implement the OpenFeature Remote Evaluation Protocol (OFREP), keeping EdgeFlags usable without coupling clients to a custom evaluation contract.

## API

Initial endpoints:

```http
GET /flags/:key
PUT /flags/:key
DELETE /flags/:key

GET /evaluate/:key
```

The API will intentionally remain small so the focus stays on infrastructure and platform concerns rather than business logic.

## Storage model

Cloudflare KV will initially be used as the backing store for feature flags.

A possible key model is:

```text
flags:{environment}:{flagKey}
```

Example:

```text
flags:dev:new-checkout
flags:prod:new-checkout
```

The exact value schema will evolve with the feature model, but it should remain explicit and versionable.

### KV consistency

Workers KV is optimized for read-heavy workloads and is **eventually consistent**.

A write is usually visible quickly in the location where it was performed, while other Cloudflare locations may continue serving an older cached value for roughly 60 seconds or longer.

This behavior is important for feature flags and will be treated as a first-class experiment rather than hidden behind the implementation.

The project should explicitly test scenarios such as:

- updating a flag and observing propagation delay,
- reading a recently created flag from different locations,
- evaluating whether stale values are acceptable,
- documenting when a stronger consistency model would be required.

## Security

The project will experiment with API-level security using:

- API keys
- API key hashing
- Client identification
- Scopes / permissions
- Key rotation
- Key revocation
- Rate limiting by client where the selected free-tier mechanism allows it
- Rate limiting by IP
- Audit logging

Example:

```http
X-API-Key: <api-key>
```

Possible scopes:

```text
flags:read
flags:write
flags:admin
```

Authentication and rate limiting are separate concerns.

An authenticated client may still be rate limited.

## Infrastructure

Infrastructure is managed as code using:

- Terraform
- Terragrunt
- Cloudflare Terraform Provider

Terraform is responsible for defining infrastructure resources.

Terragrunt is used to experiment with:

- Environment-specific configuration
- Shared Terraform configuration
- Module reuse
- Dependency management
- Remote state configuration

Example environments:

```text
dev
prod
```

Even if a multi-environment setup is unnecessary for such a small project, it is included intentionally for learning purposes.

## Repository structure

```text
.
├── app/
│   ├── src/
│   ├── test/
│   ├── package.json
│   ├── tsconfig.json
│   └── wrangler.toml
│
├── infra/
│   ├── modules/
│   │   ├── worker/
│   │   ├── kv/
│   │   └── observability/
│   │
│   └── live/
│       ├── dev/
│       └── prod/
│
├── observability/
│   ├── dashboards/
│   ├── alerts/
│   └── slo/
│
├── load-tests/
│   └── k6/
│
├── docs/
│   └── adr/
│
├── .github/
│   └── workflows/
│
├── .mise.toml
└── README.md
```

The repository is intentionally self-contained.

Application code, infrastructure, CI/CD configuration, observability resources, tests, and architectural documentation live together.

## Getting started

> [!NOTE]
> The application is not implemented yet. This section documents the target local workflow and will be updated as the bootstrap phases are completed.

The intended setup flow is:

```bash
# Install the versions pinned by the repository
mise install

# Authenticate against Cloudflare when Wrangler is introduced
wrangler login

# Start the Worker locally
mise run dev
```

Infrastructure workflows will eventually be available through the same task interface:

```bash
mise run infra:fmt
mise run infra:validate
mise run infra:plan
mise run infra:apply
```

The goal is for a new clone to contain everything necessary to understand, validate, run, and recreate the project without relying on undocumented machine-level setup.

## Configuration and secrets

Configuration should be explicit and divided into non-secret configuration and credentials.

Expected categories include:

| Configuration | Purpose | Secret |
| --- | --- | --- |
| Cloudflare account identifier | Terraform/Wrangler account selection | No |
| Cloudflare API token | IaC and deployment authentication | Yes |
| KV namespace/bindings | Worker storage configuration | No |
| API key hashing secret/pepper, if used | Credential protection | Yes |
| Grafana/OTLP credentials, if enabled | External observability | Yes |

Secrets must not be committed to the repository or stored as plaintext Terraform values/state where avoidable.

Local development should use Wrangler/mise-supported secret mechanisms, while CI/CD should use GitHub Actions secrets or environment-level credentials.

The exact variable names will be documented when the corresponding components are implemented.

## Toolchain

[mise](https://mise.jdx.dev/) is used to manage tool versions and provide a common development interface.

The goal is to avoid requiring developers or CI pipelines to manually install arbitrary tool versions.

Planned tooling includes:

| Area | Tool |
| --- | --- |
| Runtime | TypeScript + Cloudflare Workers |
| Cloudflare development | Wrangler |
| Storage | Cloudflare KV |
| Feature flag interoperability | OpenFeature / OFREP |
| IaC | Terraform + Terragrunt |
| Terraform linting | TFLint |
| Tool versions/tasks | mise |
| Tests | Vitest |
| Lint/format | Biome |
| Load testing | k6 |
| Security scanning | Trivy |
| CI/CD | GitHub Actions |
| Observability/SRE | Grafana + SLI/SLO experiments |

Example commands:

```bash
mise install

mise run dev
mise run test
mise run lint

mise run infra:fmt
mise run infra:plan
mise run infra:apply

mise run load-test
```

Whenever practical, GitHub Actions should execute the same `mise` tasks used locally.

## Testing strategy

Testing will be split by purpose rather than relying on a single end-to-end suite.

### Unit tests

Vitest will cover pure flag-evaluation behavior such as:

- boolean evaluation,
- percentage rollout boundaries,
- deterministic user assignment,
- authorization decisions,
- parsing and validation.

### Worker integration tests

Integration tests should exercise the Worker request lifecycle and Cloudflare bindings using the Workers testing tooling available at implementation time.

### Infrastructure tests

IaC checks should include:

```text
terraform fmt
terraform validate
tflint
terragrunt plan
```

### Smoke tests

A deployment should be followed by a small request suite that verifies that the deployed Worker can read and evaluate a known flag.

### Load and failure tests

k6 will be used separately for performance, rate-limit, latency, and failure experiments.

## CI/CD

GitHub Actions is used to experiment with a complete CI/CD workflow.

Pull requests should run checks such as:

```text
format
lint
typecheck
tests
security scanning

terraform fmt
terraform validate
tflint
terragrunt plan
```

Changes merged into the main branch may trigger:

```text
CI
 │
 ▼
Infrastructure apply
 │
 ▼
Worker deployment
 │
 ▼
Smoke tests
```

The objective is to keep workflow files relatively thin and move reusable commands into the repository tooling whenever possible.

## Observability

The project aims to experiment with the three main observability signals while respecting the free-tier-first constraint.

### Metrics

Desired application-level metrics include:

```text
http_requests_total
http_request_duration_seconds

feature_flag_evaluations_total
feature_flag_evaluation_duration_seconds

kv_requests_total
kv_errors_total

authentication_failures_total
authorization_denied_total
rate_limited_requests_total
```

These names represent the desired signals, not a guarantee that they will all be exported through Cloudflare's native OpenTelemetry integration. The actual free-tier-compatible metrics path will be selected during the observability phase.

### Logs

Logs should be structured and include useful contextual information.

Example:

```json
{
  "level": "info",
  "traceId": "...",
  "clientId": "example-client",
  "flag": "new-checkout",
  "enabled": true,
  "durationMs": 3
}
```

### Traces

Example trace:

```text
GET /evaluate/new-checkout
 │
 ├── authenticate
 ├── authorize
 ├── KV.get
 ├── evaluate flag
 └── serialize response
```

### Current Cloudflare OTel limitation

As of the current project bootstrap:

- Workers OTel export supports logs and traces, not Worker/custom metrics.
- Direct OTel export to external destinations is not available on the Workers Free plan.

Because EdgeFlags is free-tier first, the observability phase must validate an alternative path before Grafana export is considered part of the default deployment.

## SRE

The project will also be used as an SRE playground.

Example SLIs:

```text
Availability:

successful evaluations
────────────────────────
total evaluations
```

```text
Latency:

evaluations completed under threshold
─────────────────────────────────────
total evaluations
```

Example SLOs:

```text
Availability: 99.9%

Latency:
99% of flag evaluations < 50 ms
```

This will allow experimentation with:

- SLIs
- SLOs
- Error budgets
- Burn rates
- Alerting
- Failure scenarios
- Artificial latency
- Dependency failures

## Load testing

[k6](https://k6.io/) will be used to generate synthetic traffic.

Example scenarios may include:

- Normal traffic
- Traffic spikes
- Repeated flag evaluation
- Rate-limit exhaustion
- Concurrent clients
- Latency degradation
- Error injection

The purpose is to correlate generated traffic with whatever metrics, logs, traces, and alerts are available in the selected free-tier observability stack.

## Experiments

The repository should contain repeatable experiments rather than only implementation milestones.

Planned experiments include:

- [ ] Measure KV propagation delay after a flag update
- [ ] Observe stale reads across locations
- [ ] Exhaust the configured rate limit and inspect `429` behavior
- [ ] Rotate an API key without interrupting valid clients
- [ ] Inject 500 ms of latency and observe the latency SLI
- [ ] Inject evaluation failures and observe the availability SLI
- [ ] Generate a traffic spike with k6
- [ ] Destroy and recreate the development infrastructure with Terragrunt
- [ ] Compare local and deployed Worker behavior
- [ ] Evaluate an OpenFeature/OFREP-compatible integration

Each experiment should document its hypothesis, procedure, expected result, and observations when useful.

## Architecture Decision Records

Important architecture choices should be documented under `docs/adr/`.

Examples:

```text
0001-use-cloudflare-workers.md
0002-use-kv-for-feature-flags.md
0003-use-terraform-and-terragrunt.md
0004-use-api-keys.md
```

ADRs are intentionally included because this is a learning repository: documenting why a choice was made is as valuable as recording the final implementation.

## Security tooling

The project may include tools such as:

- Trivy
- TFLint
- Dependabot or Renovate
- GitHub security scanning

These tools are included primarily to understand how application and infrastructure security checks fit into a CI/CD pipeline.

## Roadmap

### Phase 1 — Application

- [ ] Create Cloudflare Worker
- [ ] Add TypeScript
- [ ] Add Vitest
- [ ] Add Biome
- [ ] Implement boolean feature flags
- [ ] Connect Worker to KV
- [ ] Add basic tests

### Phase 2 — Developer tooling

- [ ] Add mise
- [ ] Pin tool versions
- [ ] Add development tasks
- [ ] Make local and CI commands share the same task interface

### Phase 3 — Infrastructure

- [ ] Add Terraform
- [ ] Provision Cloudflare resources
- [ ] Add Terragrunt
- [ ] Create `dev` and `prod` environments
- [ ] Add infrastructure validation
- [ ] Confirm all default resources fit within the selected free tiers

### Phase 4 — CI/CD

- [ ] Add GitHub Actions
- [ ] Run application CI
- [ ] Run Terraform/Terragrunt plan on pull requests
- [ ] Deploy automatically from `main`
- [ ] Add smoke tests

### Phase 5 — Security

- [ ] Add API keys
- [ ] Hash stored credentials
- [ ] Add scopes
- [ ] Add rate limiting
- [ ] Add audit logs
- [ ] Add security scanning

### Phase 6 — Feature flag evaluation

- [ ] Percentage rollouts
- [ ] Deterministic user assignment
- [ ] Evaluation context
- [ ] Targeting rules
- [ ] Multiple environments
- [ ] Evaluate OpenFeature/OFREP compatibility

### Phase 7 — Observability

- [ ] Evaluate free-tier-compatible telemetry options
- [ ] Add structured logs
- [ ] Add tracing where the selected free-tier path allows it
- [ ] Define the metrics collection/export strategy
- [ ] Create Grafana dashboards if the selected path supports Grafana Cloud

### Phase 8 — SRE

- [ ] Define SLIs
- [ ] Define SLOs
- [ ] Calculate error budgets
- [ ] Configure alerts where supported
- [ ] Test burn-rate scenarios

### Phase 9 — Load and failure testing

- [ ] Add k6
- [ ] Create baseline load test
- [ ] Test rate limiting
- [ ] Inject latency
- [ ] Inject failures
- [ ] Observe impact in the selected observability stack

### Phase 10 — Architecture documentation

- [ ] Add ADR template
- [ ] Document major infrastructure decisions
- [ ] Record KV consistency findings
- [ ] Document free-tier trade-offs discovered during implementation

## Definition of done

A phase should not be considered complete merely because its files exist.

Each phase should have an observable outcome. Examples:

- **Application:** a local Worker can create/read/evaluate a boolean flag.
- **Infrastructure:** `terragrunt apply` can recreate the development environment from scratch.
- **CI/CD:** a pull request produces validation and an infrastructure plan without manual local steps.
- **Security:** abusive traffic results in a predictable `429` response and valid API keys can be rotated.
- **Observability:** a documented request can be followed through the signals available in the chosen free-tier stack.
- **SRE:** an intentionally injected failure changes the defined SLI/SLO state in a measurable way.

## Non-goals

This project is **not** currently intended to:

- Compete with LaunchDarkly, Unleash, or similar platforms
- Provide production-grade multi-tenancy
- Guarantee high availability
- Support large-scale production traffic
- Provide a polished administration UI
- Act as a production authentication system
- Introduce infrastructure that exists only to make the architecture look more complex

Complexity should only be introduced when it provides something useful to learn.

## Why feature flags?

Feature flag evaluation has a deliberately simple core domain:

```text
input
  ↓
load flag
  ↓
evaluate rules
  ↓
return value
```

This makes it useful as a sandbox because most of the engineering effort can be focused on the surrounding platform:

```text
application
infrastructure
deployment
security
observability
reliability
```

That is the actual purpose of EdgeFlags.
