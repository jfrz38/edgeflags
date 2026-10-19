# EdgeFlags Architecture

This document describes the implemented core architecture, its planned
evolution, and the constraints that shape it. EdgeFlags currently provides the
boolean feature flag service backed by a local Cloudflare KV binding.

## Status language

The documentation uses the following terms:

- **Current:** present in the repository and verifiable now.
- **Target:** an agreed direction that has not necessarily been implemented.
- **TBD:** a choice that must be investigated before it is accepted.

Technology-specific decisions with meaningful alternatives and consequences are
recorded as [Architecture Decision Records](adr/README.md).

## Architectural drivers

EdgeFlags is designed around these constraints:

- Keep the feature flag domain small enough to expose platform concerns.
- Prefer services and configurations that fit within free tiers.
- Make local workflows and infrastructure reproducible from the repository.
- Treat eventual consistency and provider limits as behavior to measure, not
  implementation details to hide.
- Add complexity only when it supports a stated learning objective.
- Keep the service usable without requiring OpenFeature-specific clients.

## System context

```text
                         +-------------------+
                         |      Client       |
                         +---------+---------+
                                   |
                                   v
                         +-------------------+
                         | Cloudflare edge   |
                         | TLS and platform  |
                         | protections       |
                         +---------+---------+
                                   |
                                   v
                         +-------------------+
                         | TypeScript Worker |
                         | API and evaluation|
                         +---------+---------+
                                   |
                                   v
                         +-------------------+
                         | Cloudflare KV     |
                         | Feature flags     |
                         +-------------------+

                                   |
                                   | telemetry (TBD)
                                   v
                         +-------------------+
                         | Observability     |
                         | free-tier path    |
                         +-------------------+
```

The TypeScript Worker and Cloudflare KV binding are current. Terraform provisions
the development namespace and development delivery applies infrastructure and
deploys the Worker automatically. Cloudflare Access support and internal scopes
are implemented behind coordinated activation while their remote behavior is
validated. The telemetry path remains subject to a feasibility experiment.

## Component responsibilities

### Cloudflare edge

Cloudflare terminates requests before they reach the Worker. Platform-native
protections may be used when their behavior and pricing fit the project
constraints.

Rate limiting is a target capability, but its location and mechanism remain TBD
until the abuse-protection phase. Authentication and rate limiting are separate
concerns: an authenticated client can still exceed its allowed request rate.

### TypeScript Worker

The Worker is the application boundary. Its planned responsibilities are:

- parse and validate HTTP requests,
- authenticate clients and authorize operations when security is introduced,
- coordinate feature flag persistence,
- evaluate flags,
- map application outcomes to HTTP responses, and
- emit the telemetry supported by the selected observability path.

Business rules should remain testable independently from Cloudflare request and
storage APIs. The exact internal module structure will be selected while the
application is implemented rather than prescribed in advance.

The implemented core follows these organization conventions:

- each public class, interface, and independently reusable type has its own file,
- each application use case represents one action and exposes `dispatch`,
- HTTP handlers depend only on the use case needed by their operation, and
- private implementation details remain with the responsibility that owns them.

These conventions favor small, directly named units over service files that
group unrelated operations. The dependency direction remains infrastructure to
application to domain regardless of file size.

### Cloudflare KV

KV is the implemented persistent store for feature flags. It is selected for its
edge-oriented, read-heavy model and as a deliberate opportunity to study
eventual consistency. Local development uses Wrangler-managed local state; the
development remote namespace is managed by Terraform.

KV must not be presented as strongly consistent. Updates can remain stale at
other locations, so experiments will measure propagation and document when this
storage model is unsuitable.

### Observability path

The desired signals are structured logs, traces, and application-level metrics.
The default export path is TBD because Cloudflare plan capabilities and external
service free tiers can change.

The observability phase must revalidate current provider limits before choosing
a path. Grafana Cloud may be used only if a free-tier-compatible integration can
provide the signals needed by the planned experiments.

Initial research recorded during project design found that Cloudflare Workers'
native OpenTelemetry integration exported logs and traces but not Worker or
custom metrics, and that direct export to external destinations was not
available on the Workers Free plan. These are time-sensitive provider
capabilities, not permanent architectural facts. Phase 12 must confirm them
against the current Cloudflare documentation and pricing.

## Feature flag model

The implemented model contains boolean flags:

```json
{
  "key": "new-checkout",
  "enabled": true
}
```

Evaluation is intentionally direct: an existing flag returns its boolean value,
while an absent flag produces a not-found result. Keys contain 1 to 64 lowercase
letters, numbers, or hyphens and start with a letter or number.

Later phases may extend the model with:

- deterministic percentage rollouts,
- evaluation context and targeting rules,
- multiple environments,
- typed values, and
- OpenFeature-compatible resolution details.

An illustrative rollout assignment is:

```text
hash(flag key + stable subject identifier) % 100 < rollout percentage
```

The hash algorithm and compatibility guarantees are TBD until rollout behavior
is designed and tested.

## HTTP API

The implemented surface is:

```http
GET /flags/:key
PUT /flags/:key
DELETE /flags/:key
GET /evaluate/:key
```

The management endpoints create, replace, read, and delete flag definitions.
The evaluation endpoint returns the effective value without exposing storage
details.

Request schemas, responses, status codes, and errors are specified in
[API.md](API.md) and covered by Worker integration tests.

## Storage model

The current implementation uses `KvFlagRepository` behind the application
storage boundary. The Worker receives the `FLAGS_KV` binding from its runtime;
domain and application code do not import Cloudflare APIs.

The current KV key format is:

```text
flags:{flagKey}
```

Values use a strict versioned representation:

```json
{
  "version": 1,
  "key": "new-checkout",
  "enabled": true
}
```

Malformed data, unsupported versions, unexpected fields, and mismatched embedded
keys are treated as internal storage failures. Environment-aware keys remain a
target for the advanced evaluation phase and will require an explicit
compatibility decision.

KV reads and existence checks are not strongly consistent. The API preserves
the `PUT` distinction between `201 Created` and `200 OK`, but that result depends
on the value visible to the read before the write and is not an atomic global
creation guarantee. A read after a write or delete can also observe stale data
from another location.

Expected consistency experiments include:

- measure propagation after creating or updating a flag,
- observe stale reads from different locations,
- determine whether stale evaluations are acceptable, and
- identify use cases that require a stronger consistency model.

## Security boundaries

Cloudflare Access authenticates human operators and automated clients before
protected requests reach the Worker. Direct Worker invocations expose the
authenticated Access context through `ctx.access`; infrastructure translates
human identity from `getIdentity()` and non-identity Service Auth from the
Access-validated Client ID header into a stable internal client identity. The
header is never trusted without `ctx.access`, and Cloudflare details do not enter
application or domain code.

EdgeFlags owns method-level authorization through `flags:read`, `flags:write`,
and `flags:evaluate`. The environment authorization policy is a Worker secret.
Missing identity, malformed policy, unknown principals, and insufficient scopes
fail closed. Access Service Tokens provide automation credentials and are
created outside Terraform so their one-time Client Secrets do not enter remote
state. Each automated consumer uses a distinct token and is authorized through
the stable Service Token Client ID exposed by Access; an application audience is
never treated as a client identity.

```text
Client -> Cloudflare Access -> Access identity -> scope policy
       -> HTTP handler -> use case -> environment KV namespace
```

Authentication does not imply ownership. All authorized clients in an
environment operate on its shared flags. Multi-tenancy and per-user KV
namespaces remain non-goals. Rate limits by client or IP and security audit
events belong to later phases.

The protected API is initially server-to-server. Service Token secrets must not
be embedded in browser, mobile, or other publicly distributed clients; those
clients must call through a trusted backend unless a separate public evaluation
contract is designed later.

Secrets must not be committed to the repository. They must also be kept out of
Terraform state where practical.

## OpenFeature interoperability

OpenFeature is an interoperability goal, not a prerequisite for the initial
application. EdgeFlags will first establish its own small evaluation model and
then assess:

- evaluation context,
- typed values,
- resolution details,
- provider responsibilities,
- hooks and events, and
- remote evaluation through OFREP.

The project may implement an OpenFeature provider, OFREP, another compatible
boundary, or document why an option does not fit. Clients should not be forced to
adopt OpenFeature merely to use the base HTTP API.

## Operational signals

Candidate signal names include:

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

These are signal requirements, not promises about metric names or export
technology. Concrete names and collection mechanisms will be defined after the
free-tier observability path is validated.

## Reliability model

The SRE phase will derive measurable indicators from the signals that are
actually available. Initial candidates are:

```text
availability = successful evaluations / total evaluations

latency compliance = evaluations completed under threshold / total evaluations
```

An availability objective of 99.9% and an objective of 99% of evaluations under
50 ms are illustrative starting points only. They must not become accepted SLOs
until traffic, measurement boundaries, and the free-tier telemetry path make
them meaningful and measurable.

## Non-goals

The architecture is not designed to provide:

- production-grade multi-tenancy,
- high-availability guarantees,
- a general identity platform,
- a management user interface,
- strong consistency over KV, or
- infrastructure without a concrete experiment or learning objective.
