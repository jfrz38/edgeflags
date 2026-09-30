# EdgeFlags

EdgeFlags is a lightweight feature flag service built as a learning playground for
Cloudflare Workers, infrastructure as code, delivery automation, security,
observability, and site reliability engineering.

> [!IMPORTANT]
> EdgeFlags is not intended to be a production-ready feature flag platform. The
> feature flag domain is deliberately small so the project can focus on the
> engineering practices around it.

## Current status

Phase 1, the project bootstrap, is complete. The repository contains a minimal
local Worker and a reproducible development toolchain. Feature flag behavior and
cloud infrastructure have not been implemented yet.

The APIs, infrastructure, and broader architecture described in the
documentation remain target outcomes. They will become available incrementally
as the roadmap is implemented.

## Purpose

EdgeFlags provides a self-contained environment for learning and experimenting
with:

- TypeScript and Cloudflare Workers
- Cloudflare KV and eventual consistency
- OpenFeature and OFREP interoperability
- Terraform and Terragrunt
- GitHub Actions and deployment automation
- API authentication, authorization, and abuse protection
- Logs, metrics, traces, SLIs, SLOs, and alerts
- Load testing and controlled failure injection
- Security and dependency scanning
- Architecture Decision Records

The goal is not to maximize the number of tools. Every capability should support
a concrete learning objective, experiment, or operational outcome.

## Principles

### Free-tier first

Default local and deployed environments should use free tiers whenever possible.
A capability that requires a paid service must have a free alternative, remain
optional, or be documented without being enabled by default.

### Reproducible by default

Tool versions, development commands, infrastructure, tests, and experiments
should live in the repository. A new clone should not depend on undocumented
machine-level setup.

### Observable outcomes

A phase is complete only when its result can be demonstrated or measured. Adding
configuration files without validating their behavior is not enough.

### Decisions with context

Significant choices should record their constraints, alternatives, trade-offs,
and validation method in an Architecture Decision Record.

## Target architecture

```text
Client
  |
  v
Cloudflare edge
  |
  v
TypeScript Worker -----> telemetry path (to be validated)
  |
  v
Cloudflare KV
```

The initial product scope is intentionally small: create, read, delete, and
evaluate boolean feature flags. Later phases add security, deterministic
rollouts, targeting, interoperability, and operational experiments.

See [Architecture](docs/ARCHITECTURE.md) for component responsibilities,
interfaces, constraints, and planned evolution.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): target system design and boundaries
- [Development](docs/DEVELOPMENT.md): target local workflow, tools, and tests
- [Delivery](docs/DELIVERY.md): branches, environments, CI, and deployments
- [Roadmap](docs/ROADMAP.md): canonical implementation order and outcomes
- [Experiments](docs/EXPERIMENTS.md): planned experiments and result template
- [Architecture decisions](docs/adr/README.md): ADR policy and records

## Roadmap

Implementation is organized into 17 incremental phases, beginning with the
project bootstrap and ending with hardening, documentation, and a retrospective.
Each phase has explicit deliverables, dependencies, exclusions, and completion
criteria.

The canonical roadmap is [docs/ROADMAP.md](docs/ROADMAP.md). GitHub milestones
will represent phases, while issues will represent reviewable units of work.

## Developer workflow

Install the pinned toolchain and application dependencies from a clean clone:

```bash
mise install
make install
```

The shared task interface is:

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

Infrastructure, security, and load-testing tasks will be added through the same
interface in their corresponding phases. The Make targets delegate tool
execution to the versions and tasks managed by mise.

Installing dependencies also configures the Husky pre-commit hook. The hook runs
the fast `make pre-commit` checks and can be invoked directly when needed. It is
a local feedback mechanism; repository validation must not rely on a hook that
Git allows contributors to skip.

## Branches and releases

- Development branches merge into `develop` through pull requests.
- `develop` is the integration branch for ongoing work.
- `main` contains the stable state of the project.
- Promoting `develop` to `main` represents a production release and will trigger
  production deployment once continuous delivery is implemented.

See [Delivery](docs/DELIVERY.md) for the complete target workflow.

## Non-goals

EdgeFlags is not intended to:

- compete with established feature flag platforms,
- provide production-grade multi-tenancy or availability guarantees,
- support large-scale production traffic,
- provide a polished administration interface,
- act as a production identity platform, or
- introduce infrastructure solely to make the design look more complex.

## License

See [LICENSE](LICENSE).
