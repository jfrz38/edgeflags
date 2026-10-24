# EdgeFlags Roadmap

This document is the canonical implementation roadmap for EdgeFlags. It defines
the order, scope, and observable outcome of each phase. The
[README](../README.md) provides only a summary and must not maintain a separate
phase list.

EdgeFlags has completed **Phases 1 through 6 and Phase 8**. Phase 7's development
delivery path is operational: merges to `develop` back up remote state, apply the
reviewed plan, deploy the Worker, and pass an authenticated remote smoke test.
The protected production workflow and pre-merge production plan are implemented.
Production bootstrap, state recovery exercises, and a successful manually started
promotion remain before Phase 7 can be completed.

## Planning model

- Each phase maps to one GitHub milestone.
- Milestone issues represent reviewable units of work, not the whole phase.
- Only the active phase and, when useful, the next phase are decomposed in
  detail. Later phases remain outcome-oriented until their prerequisites exist.
- An issue should normally be small enough to produce one focused pull request.
- Significant decisions discovered during implementation are recorded as ADRs.
- Experiments follow the process in [EXPERIMENTS.md](EXPERIMENTS.md).

The roadmap can change when implementation reveals a false assumption, provider
limitation, or better learning sequence. Such changes must update this document
rather than creating a second plan elsewhere.

## Phase 1 - Project bootstrap

**Status:** Completed on 2026-09-30.

### Objective

Establish a runnable and testable TypeScript Cloudflare Worker with a reproducible
developer toolchain.

### Deliverables

- Initial `app/` structure and minimal Worker entry point.
- TypeScript and Wrangler configuration.
- A selected JavaScript package manager and committed lockfile.
- mise-managed tool versions and development tasks.
- Biome formatting and linting.
- Vitest configuration and bootstrap tests.

### Completion criteria

From a clean clone, the documented setup installs the pinned tools and the shared
tasks can start, format, lint, type-check, and test a minimal local Worker.

### Dependencies

None.

### Explicitly out of scope

Feature flag behavior, KV persistence, cloud infrastructure, and CI.

## Phase 2 - Core feature flags

**Status:** Completed on 2026-10-06.

### Objective

Implement the smallest useful feature flag service without depending on remote
storage.

### Deliverables

- Boolean feature flag model and validation rules.
- Temporary local or in-memory storage boundary.
- Create or replace, read, delete, and evaluate operations.
- Initial HTTP request, response, status-code, and error contracts.
- Architecture-boundary configuration based on the implemented layers, enforced
  locally and through the shared checks with
  `@jfrz38/clean-architecture-highlighter-cli`.
- Unit and Worker integration tests for the supported behavior.

### Completion criteria

A local Worker can create, read, delete, and evaluate a boolean flag through the
documented API, with automated tests covering success and failure behavior.

### Dependencies

Phase 1.

### Explicitly out of scope

Cloudflare KV, authentication, rollouts, targeting, and multiple environments.

## Phase 3 - Cloudflare KV integration

**Status:** Completed on 2026-10-08.

### Objective

Replace temporary storage with a Cloudflare KV adapter while preserving the core
application behavior.

### Deliverables

- Versioned persisted flag representation.
- KV binding and storage adapter.
- Local integration tests using the selected Workers testing tooling.
- Documented consistency expectations and remote-validation procedure.
- Separation between feature flag behavior and Cloudflare storage APIs.

### Completion criteria

The Worker uses the KV binding in local development and integration tests. The
same core behavior remains testable without KV, and the remote checks to run once
infrastructure exists are documented.

### Dependencies

Phase 2.

### Explicitly out of scope

Reproducible cloud provisioning, multi-environment keys, and propagation-delay
measurements across locations. Remote validation completes in Phases 4 and 15.

## Phase 4 - Terraform foundation

**Status:** Completed on 2026-10-15.

The documented Terraform workflow created the development namespace in
Cloudflare, supplied its binding to the deployed Worker, and supported the full
flag lifecycle against remote KV. The resources were then destroyed and
recreated without undocumented console steps.

### Objective

Provision the initial Cloudflare resources reproducibly with Terraform and prove
that the KV-backed Worker can use them.

### Deliverables

- Terraform provider and version constraints.
- Initial reusable modules for required Cloudflare resources.
- Variables, outputs, and non-secret configuration documentation.
- State and credential handling appropriate for the learning environment.
- Formatting and validation tasks.
- Remote validation of the KV binding created from code.

### Completion criteria

The initial development resources can be created from the documented Terraform
workflow, validated, used by the Worker, and destroyed without undocumented
console steps.

### Dependencies

Phase 3 and access to a suitable Cloudflare account.

### Explicitly out of scope

Terragrunt composition, production infrastructure, and automated deployment.

## Phase 5 - Terragrunt and environments

**Status:** Completed on 2026-10-15.

Terragrunt composition, separate environment inputs, local state isolation, and
validation for both environments are implemented. Account-backed development
recreation succeeded, and the production configuration produced a reviewed plan
for the expected isolated namespace without applying production changes.

### Objective

Introduce shared infrastructure composition and distinct `dev` and `prod`
configurations without duplicating Terraform modules.

### Deliverables

- Terragrunt configuration and pinned version.
- Shared configuration for account, region-independent resources, and state.
- Separate `dev` and `prod` environment inputs.
- Environment-specific validation and plan tasks.
- Documented free-tier resource inventory.

### Completion criteria

The development environment can be recreated through Terragrunt, the production
configuration produces a reviewable plan, and both default configurations are
shown to fit the selected free tiers.

### Dependencies

Phase 4.

### Explicitly out of scope

Automatic apply, Worker deployment from GitHub, and environment-specific feature
flag behavior inside the application.

## Phase 6 - Continuous integration

**Status:** Completed on 2026-10-14.

The pull request workflow runs application, credential-free infrastructure, and
security checks in separate least-privilege jobs. Mocked Terraform apply/plan
runs cover the development and production variants, and a local integration test
verifies the generated Worker binding against Miniflare KV. Pinned Trivy scans
dependencies, secrets, and Terraform configuration with an actionable failure
policy. Remote plans remain deferred until shared state and appropriately scoped
Cloudflare credentials exist.

### Objective

Run the same application and infrastructure validation in GitHub Actions that a
developer can run locally.

### Deliverables

- Pull request workflows for application checks.
- Terraform and Terragrunt formatting, validation, and plans where applicable.
- Initial dependency or security checks that are stable enough to gate changes.
- Caching that does not compromise reproducibility.
- Least-privilege workflow permissions and documented required secrets.

### Completion criteria

A pull request into `develop` reports formatting, linting, type-checking, tests,
security scanning, and applicable credential-free infrastructure validation
without requiring undocumented manual steps or repository secrets. Remote plans
will be added only when shared state makes their output accurate and reviewable.

### Dependencies

Phases 1 through 5.

### Explicitly out of scope

Infrastructure apply, Worker deployment, production promotion, and smoke tests
against a newly deployed release.

## Phase 7 - Continuous deployment

**Status:** In progress since 2026-10-15.

Development CD, environment-scoped remote plans, R2 state backups, exact-plan
apply, Worker deployment, and smoke tests are active and have completed
successfully. Production automation now provides a separate least-privilege plan,
manual dispatch from `main`, enforced Access configuration, and a smoke
test that proves protected routes fail closed. It remains disabled until the
isolated production state, credentials, 30-day backup retention, lock and restore
exercises, and first authorized promotion are validated remotely.

### Objective

Automate controlled environment deployment and verify each deployment through a
small smoke-test suite.

### Deliverables

- A documented deployment trigger for the `dev` environment.
- Production deployment after promotion from `develop` to `main`.
- Infrastructure apply and Worker deployment ordering.
- Post-deployment smoke tests.
- GitHub environment protections and deployment credentials where supported.
- Documented failure and rollback procedure.

### Completion criteria

A successful promotion to `main` deploys the intended production configuration
and Worker, then verifies a known flag through smoke tests. Failed validation or
deployment produces an actionable failure and a documented recovery path.

### Dependencies

Phase 6.

### Explicitly out of scope

Progressive delivery, production-grade high availability, and complex rollback
orchestration.

## Phase 8 - API security

**Status:** Completed on 2026-10-24.

Development Access rejects unauthenticated protected requests, maps verified
human and Service Auth context to internal identities, and enforces operation
scopes. Remote checks demonstrated insufficient-scope denial without KV mutation,
authenticated deployment smoke tests, overlapping Service Token rotation, and
rejection of the previous secret after replacement adoption.

### Objective

Authenticate API clients and authorize operations without storing reusable
credentials in plaintext.

### Deliverables

- Cloudflare Access authentication for human and automated clients.
- Service Token bootstrap without storing its Client Secret in Terraform state.
- Stable client identity and scope definitions.
- Authorization rules for management and evaluation operations.
- Environment-scoped authorization policy and deployment integration.
- Service Token rotation and revocation procedures.
- Security-focused unit and integration tests.

### Completion criteria

Access rejects unauthenticated protected operations before they reach the Worker,
and EdgeFlags rejects authenticated identities with insufficient scopes. A
Service Token can be rotated without interrupting a client that has adopted the
replacement secret, and the old secret can then be revoked.

### Dependencies

Phases 2, 3, and the operational development-delivery foundation from Phase 7.
The production portion of Phase 7 follows this phase.

### Explicitly out of scope

User accounts, OAuth/OIDC, production identity management, and request rate
limiting.

## Phase 9 - Abuse protection

### Objective

Limit abusive request patterns and make denial behavior predictable and
observable.

### Deliverables

- A free-tier-compatible rate-limiting design.
- Limits by authenticated client or IP where feasible.
- Stable `429` response semantics.
- Security-relevant audit events.
- Tests for exhaustion, recovery, and separation between clients.

### Completion criteria

A repeatable test can exhaust a configured limit, observe the expected `429`
behavior and recovery window, and correlate the denial with an audit signal.

### Dependencies

Phase 8 and revalidation of current Cloudflare plan capabilities.

### Explicitly out of scope

Advanced bot management, DDoS guarantees, and load-capacity analysis.

## Phase 10 - Advanced flag evaluation

### Objective

Evolve boolean evaluation into deterministic, context-aware flag resolution.

### Deliverables

- Percentage rollout model and boundary behavior.
- Stable deterministic subject assignment.
- Evaluation context and targeting rules.
- Application-level environment support.
- Typed flag values and resolution details where justified.
- Compatibility and migration rules for existing persisted flags.

### Completion criteria

Automated tests prove deterministic assignment, rollout boundaries, context
matching, environment isolation, typed value behavior, and compatibility with
flags created by earlier phases.

### Dependencies

Phases 2, 3, and 8.

### Explicitly out of scope

A graphical rule editor, arbitrary scripting, and OpenFeature protocol support.

## Phase 11 - OpenFeature interoperability

### Objective

Determine and implement the smallest useful OpenFeature integration without
coupling the base EdgeFlags API to a single client ecosystem.

### Deliverables

- Compatibility analysis against the implemented evaluation model.
- A documented decision covering provider and OFREP alternatives.
- The selected provider, OFREP boundary, or another justified integration.
- Interoperability tests and client example.
- Documented unsupported OpenFeature capabilities.

### Completion criteria

A documented client can evaluate supported EdgeFlags values through the selected
OpenFeature-compatible boundary, or the phase records evidence explaining why
implementation is not appropriate.

### Dependencies

Phase 10.

### Explicitly out of scope

Claiming full specification conformance without conformance evidence or adding
features solely to mirror another platform.

## Phase 12 - Observability

### Objective

Select a free-tier-compatible telemetry path and make important request and
evaluation behavior diagnosable.

### Deliverables

- Current Cloudflare and telemetry-provider capability assessment.
- Structured application logs with safe contextual fields.
- Trace propagation and spans where the selected path supports them.
- A documented application metrics strategy.
- Grafana Cloud integration and dashboards if the validated path supports them.
- Redaction, sampling, retention, and cost considerations.

### Completion criteria

A documented request can be followed through the signals available in the
selected free-tier design. Missing signal types and provider limitations are
explicitly documented rather than simulated or promised.

### Dependencies

Phases 7 through 9 and a fresh validation of provider pricing and capabilities.

### Explicitly out of scope

Paid telemetry as a default requirement and unsupported claims of complete
metrics, logs, or trace coverage.

## Phase 13 - SRE

### Objective

Turn available telemetry into explicit reliability indicators, objectives, and
actionable failure signals.

### Deliverables

- Availability and latency SLIs.
- Initial SLOs with rationale.
- Error budget calculation and interpretation.
- Burn-rate queries or equivalent analysis.
- Dashboards and alerts where supported by the selected stack.
- Runbook notes for each actionable alert.

### Completion criteria

Recorded traffic changes the defined SLIs and error budget in a measurable way,
and at least one controlled degradation can exercise the alerting or documented
manual detection path.

### Dependencies

Phase 12.

### Explicitly out of scope

Production reliability guarantees, an on-call program, and arbitrary objectives
that cannot be measured with the available signals.

## Phase 14 - Load and failure testing

### Objective

Generate controlled traffic and failures, then correlate system behavior with
the observability and SRE model.

### Deliverables

- Pinned k6 tooling and shared tasks.
- Baseline evaluation workload.
- Traffic spike and concurrent-client scenarios.
- Rate-limit exhaustion scenario.
- Controlled latency and evaluation failure injection.
- Recorded observations linked to dashboards, traces, logs, or SLI changes.

### Completion criteria

The documented scenarios are repeatable, protect the free-tier environment from
accidental excessive load, and produce interpretable changes in the selected
operational signals.

### Dependencies

Phases 9, 12, and 13.

### Explicitly out of scope

Capacity certification, destructive testing against production, and performance
claims beyond the measured configuration.

## Phase 15 - Distributed-system experiments

### Objective

Measure Cloudflare KV consistency behavior and determine the feature flag use
cases for which it is or is not appropriate.

### Deliverables

- KV propagation-delay experiment.
- Cross-location stale-read experiment where practical.
- Comparison of local and deployed assumptions.
- Analysis of acceptable and unacceptable stale evaluation scenarios.
- Documented alternatives when stronger consistency is required.

### Completion criteria

Experiment records contain repeatable procedures, measurements, limitations, and
a conclusion about KV suitability. Findings update the architecture or create an
ADR when they challenge an existing decision.

### Dependencies

Phases 3, 7, 12, and 14.

### Explicitly out of scope

Eliminating eventual consistency or generalizing limited measurements into
global service guarantees.

## Phase 16 - Hardening and automation

### Objective

Close tooling and maintenance gaps discovered during implementation without
adding checks that have no owner or response process.

### Deliverables

- Finalized Trivy and TFLint integration where useful.
- Dependency update automation.
- Repository and workflow security review.
- Pinned actions, tools, and infrastructure providers.
- Repeatable maintenance and upgrade tasks.
- Removal or documentation of obsolete configuration.

### Completion criteria

Security and maintenance checks run through documented local or CI workflows,
produce actionable results, and have an explicit update or exception process.

### Dependencies

All tooling and deployment phases whose artifacts are being hardened.

### Explicitly out of scope

Adding scanners only for checklist coverage or promising remediation of risks
outside the learning project's stated scope.

## Phase 17 - Documentation and retrospective

### Objective

Reconcile the original design with the implemented system and preserve the
technical and learning outcomes.

### Deliverables

- Current architecture and developer workflow documentation.
- Consolidated ADR index and decision statuses.
- Free-tier cost and capability findings.
- Experiment index and consistency conclusions.
- Production-readiness gap analysis.
- Retrospective covering successful and unsuccessful choices.

### Completion criteria

A new reader can reproduce the implemented project, distinguish demonstrated
behavior from assumptions, understand major decisions and experiments, and see
what would need to change for production use.

### Dependencies

All completed implementation and experiment phases.

### Explicitly out of scope

Reframing the learning project as a production-ready service.

## Continuous concerns

These concerns are addressed whenever a phase makes them relevant rather than
being deferred to a final cleanup:

- testing at the boundary appropriate to the risk,
- free-tier and provider-limit validation,
- security and secret handling,
- documentation of current and target behavior,
- reproducibility through mise and infrastructure as code,
- ADRs for decisions with meaningful trade-offs, and
- experiment evidence for empirical claims.

## Phase definition of done

A phase is complete when:

- its completion criterion has been demonstrated,
- its deliverables are reviewed and merged,
- applicable automated validation passes,
- user-facing commands and behavior are documented,
- secrets and free-tier constraints have been considered,
- relevant ADRs and experiments are recorded, and
- deferred work is explicit rather than hidden in an unchecked implementation
  detail.
