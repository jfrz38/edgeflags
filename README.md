# FlagForge

A lightweight feature flag service built with TypeScript, Cloudflare Workers, KV, Terraform/Terragrunt, and observability tooling for experimentation and testing.

> [!IMPORTANT]
> This project is a learning playground.
>
> It is intentionally designed to experiment with infrastructure, observability, security, CI/CD, and SRE practices around a very simple domain.
>
> It is **not intended to be used as a production-ready feature flag platform**.

## Goals

The main goal of this repository is not to build a complete feature flag product.

Instead, the feature flag domain is used as a simple excuse to experiment with technologies and engineering practices such as:

* Cloudflare Workers
* Cloudflare KV
* TypeScript
* Terraform
* Terragrunt
* mise
* GitHub Actions
* Infrastructure as Code
* API keys and authorization
* Rate limiting
* OpenTelemetry
* Grafana
* Logs, metrics, and traces
* SLI/SLO definitions
* Load testing with k6
* Infrastructure and dependency security scanning

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
                       │  Rate limiting       │
                       │  TLS / Edge          │
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
                                  │ OpenTelemetry
                                  ▼

                       ┌──────────────────────┐
                       │    Grafana Cloud     │
                       │                      │
                       │ Metrics              │
                       │ Logs                 │
                       │ Traces               │
                       │ Alerts / SLOs        │
                       └──────────────────────┘
```

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

* Percentage rollouts
* User targeting
* Environments
* Context-based rules
* Application version targeting
* Country targeting
* Multiple flag value types

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

## API

Initial endpoints:

```http
GET /flags/:key
PUT /flags/:key
DELETE /flags/:key

GET /evaluate/:key
```

The API will intentionally remain small so the focus stays on infrastructure and platform concerns rather than business logic.

## Security

The project will experiment with API-level security using:

* API keys
* API key hashing
* Client identification
* Scopes / permissions
* Key rotation
* Key revocation
* Rate limiting by client
* Rate limiting by IP
* Audit logging

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

* Terraform
* Terragrunt
* Cloudflare Terraform Provider

Terraform is responsible for defining infrastructure resources.

Terragrunt is used to experiment with:

* Environment-specific configuration
* Shared Terraform configuration
* Module reuse
* Dependency management
* Remote state configuration

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
├── .github/
│   └── workflows/
│
├── .mise.toml
└── README.md
```

The repository is intentionally self-contained.

Application code, infrastructure, CI/CD configuration, observability resources, and testing tools live together.

## Toolchain

[mise](https://mise.jdx.dev/) is used to manage tool versions and provide a common development interface.

The goal is to avoid requiring developers or CI pipelines to manually install arbitrary tool versions.

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

The Worker will be instrumented using OpenTelemetry.

The project aims to experiment with the three main observability signals:

### Metrics

Examples:

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

Grafana Cloud will be used to experiment with visualization, dashboards, alerting, logs, metrics, and distributed tracing.

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

* SLIs
* SLOs
* Error budgets
* Burn rates
* Alerting
* Failure scenarios
* Artificial latency
* Dependency failures

## Load testing

[k6](https://k6.io/) will be used to generate synthetic traffic.

Example scenarios may include:

* Normal traffic
* Traffic spikes
* Repeated flag evaluation
* Rate-limit exhaustion
* Concurrent clients
* Latency degradation
* Error injection

The purpose is to correlate generated traffic with Grafana metrics, logs, traces, and alerts.

## Security tooling

The project may include tools such as:

* Trivy
* TFLint
* Dependabot
* GitHub security scanning

These tools are included primarily to understand how application and infrastructure security checks fit into a CI/CD pipeline.

## Roadmap

### Phase 1 — Application

* [ ] Create Cloudflare Worker
* [ ] Add TypeScript
* [ ] Implement boolean feature flags
* [ ] Connect Worker to KV
* [ ] Add basic tests

### Phase 2 — Developer tooling

* [ ] Add mise
* [ ] Pin tool versions
* [ ] Add development tasks
* [ ] Add linting and formatting

### Phase 3 — Infrastructure

* [ ] Add Terraform
* [ ] Provision Cloudflare resources
* [ ] Add Terragrunt
* [ ] Create `dev` and `prod` environments
* [ ] Add infrastructure validation

### Phase 4 — CI/CD

* [ ] Add GitHub Actions
* [ ] Run application CI
* [ ] Run Terraform/Terragrunt plan on pull requests
* [ ] Deploy automatically from `main`
* [ ] Add smoke tests

### Phase 5 — Security

* [ ] Add API keys
* [ ] Hash stored credentials
* [ ] Add scopes
* [ ] Add rate limiting
* [ ] Add audit logs
* [ ] Add security scanning

### Phase 6 — Feature flag evaluation

* [ ] Percentage rollouts
* [ ] Deterministic user assignment
* [ ] Evaluation context
* [ ] Targeting rules
* [ ] Multiple environments

### Phase 7 — Observability

* [ ] Add OpenTelemetry
* [ ] Export metrics
* [ ] Export logs
* [ ] Export traces
* [ ] Create Grafana dashboards

### Phase 8 — SRE

* [ ] Define SLIs
* [ ] Define SLOs
* [ ] Calculate error budgets
* [ ] Configure alerts
* [ ] Test burn-rate scenarios

### Phase 9 — Load and failure testing

* [ ] Add k6
* [ ] Create baseline load test
* [ ] Test rate limiting
* [ ] Inject latency
* [ ] Inject failures
* [ ] Observe impact in Grafana

## Non-goals

This project is **not** currently intended to:

* Compete with LaunchDarkly, Unleash, or similar platforms
* Provide production-grade multi-tenancy
* Guarantee high availability
* Support large-scale production traffic
* Provide a polished administration UI
* Act as a production authentication system

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
