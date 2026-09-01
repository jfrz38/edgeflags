# EdgeFlags Roadmap

This roadmap intentionally stays at iteration level.

Each phase should be planned in detail locally before implementation. The purpose here is only to define the order of work and the outcome expected from each iteration.

## Phase 1 — Project bootstrap

TypeScript Cloudflare Worker, Wrangler, mise, Biome, Vitest, and the initial repository structure.

## Phase 2 — Core feature flags

Boolean flag CRUD and evaluation with a minimal local implementation and tests.

## Phase 3 — Cloudflare KV

Replace the temporary storage with Cloudflare KV and validate local/deployed Worker behavior.

## Phase 4 — Terraform foundation

Provision the initial Cloudflare resources with Terraform and make the infrastructure reproducible from code.

## Phase 5 — Terragrunt and environments

Introduce Terragrunt, shared configuration, and separate `dev` and `prod` environments while keeping the default deployment inside free tiers.

## Phase 6 — Continuous integration

Add GitHub Actions for formatting, linting, type checking, tests, security checks, Terraform validation, and infrastructure plans on pull requests.

## Phase 7 — Continuous deployment

Automate infrastructure apply, Worker deployment, and post-deployment smoke tests from `main`.

## Phase 8 — API security

Introduce API keys, credential hashing, client identification, scopes, secret handling, key rotation, and revocation.

## Phase 9 — Abuse protection

Add rate limiting, `429` behavior, audit events, and the first abuse-oriented tests.

## Phase 10 — Advanced flag evaluation

Add deterministic percentage rollouts, evaluation context, targeting rules, environments, and typed flag values.

## Phase 11 — OpenFeature interoperability

Evaluate and implement the appropriate OpenFeature integration, including OFREP if it fits the resulting architecture.

## Phase 12 — Observability

Integrate Grafana Cloud Free through a free-tier-compatible telemetry path and add structured logs, traces, metrics where feasible, and initial dashboards.

## Phase 13 — SRE

Define SLIs, SLOs, error budgets, burn-rate concepts, dashboards, and alerts using the observability stack built in the previous phase.

## Phase 14 — Load and failure testing

Add k6 scenarios, traffic spikes, rate-limit exhaustion, injected latency, injected failures, and correlate the results with Grafana.

## Phase 15 — Distributed-system experiments

Measure KV propagation delay, stale reads, consistency trade-offs, and document when KV is or is not an appropriate feature-flag store.

## Phase 16 — Hardening and automation

Add or finalize Trivy, TFLint, dependency update automation, security scanning, repository hygiene, and repeatable maintenance workflows.

## Phase 17 — Documentation and retrospective

Consolidate ADRs, document free-tier trade-offs and experiment findings, update the architecture, and record what would change for a production-grade implementation.

## Continuous concerns

These are not standalone phases and should be addressed whenever a decision warrants them:

- Architecture Decision Records
- Free-tier constraints
- Testing
- Security
- Documentation
- Reproducibility through mise and IaC
