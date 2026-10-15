# EdgeFlags Delivery

This document defines the branch, environment, and delivery model. Pull request
CI and a manual development provisioning and deployment workflow exist;
deployment automation does not.

## Branch model

EdgeFlags uses two long-lived branches with distinct responsibilities:

- `develop` is the integration branch for ongoing development.
- `main` is the stable branch and represents the production state.

Normal work should use a short-lived branch and a pull request into `develop`.
Production promotion occurs through a pull request from `develop` to `main`.

```text
short-lived branch
        |
        v
     develop
        |
        | stabilization and promotion
        v
       main
        |
        v
 production deployment
```

Direct pushes to either long-lived branch should be avoided once branch
protection is configured.

## Environment model

The Terragrunt configuration contains distinct `dev` and `prod` environments.

| Environment | Purpose | Branch relationship |
| --- | --- | --- |
| `dev` | Integration and deployed experiments | Associated with `develop`; the exact deployment trigger is TBD in Phase 7 |
| `prod` | Stable release behavior | Deployed from `main` after promotion |

Separating these environments is intentionally educational even though the
application is small. Both must remain inside the project's default free-tier
constraints.

## Pull request validation

Pull requests into `develop` or `main` run three independent, read-only jobs:

```text
Application                     Infrastructure                         Security
-----------                     --------------                         --------
architecture                    Terraform formatting                   dependency vulnerabilities
formatting                      Terragrunt formatting and validation   committed secrets
lint                            dev and prod configuration validation  infrastructure misconfiguration
typecheck                       mocked Terraform apply/plan
tests
generated binding + local KV lifecycle
```

The workflow invokes the same Make targets used locally, installs the toolchain
from `.mise.toml`, has read-only repository permissions, and receives no
Cloudflare secrets. Checkout credentials are not persisted for later steps.
Independent jobs make application, infrastructure, and security failures visible
without serializing unrelated checks.

The application job generates a temporary `dev` binding from a simulated
Terraform output and runs the Worker HTTP lifecycle against Miniflare's local KV.
This uses the deployment generator without granting CI Cloudflare access. The
infrastructure job independently verifies Terraform composition and Terragrunt
configuration. The security job uses pinned Trivy tooling and fails on fixable
HIGH or CRITICAL dependency vulnerabilities, detected secrets, and HIGH or
CRITICAL Terraform misconfigurations. The dependency policy includes development
packages because they execute in build and validation workflows.

The infrastructure summary reports the statically validated desired inventory.
It deliberately does not publish a remote plan: local state is unavailable to
an ephemeral runner, so such a plan would incorrectly report existing resources
as new. It also does not publish an automated cost estimate because Infracost
does not price the current Cloudflare KV resources. Cloudflare's documented free
allowances and the static inventory remain the applicable cost review.

Remote plan comments require a shared backend, narrowly scoped credentials, and
secret-safe output. They remain deferred until those prerequisites exist.

## Target deployment flow

The stable release flow is:

```text
PR from develop to main
          |
          v
required CI checks
          |
          v
merge to main
          |
          v
infrastructure apply
          |
          v
Worker deployment
          |
          v
smoke tests
```

Whether development deployments happen on every merge to `develop`, through a
manual workflow, or through another controlled trigger will be decided during
the continuous deployment phase.

## Current manual infrastructure flow

Terragrunt composes one KV namespace per environment. Plans are available for
both environments, while mutable commands and Worker deployment remain limited
to development:

```text
make infra-plan ENV=dev
        |
        v
review saved plan
        |
        v
make infra-apply ENV=dev
        |
        v
make deploy-dev
        |
        v
manual remote validation
```

Terraform owns each KV namespace. Wrangler owns the Worker deployment and reads
the development namespace ID from Terragrunt output through an ignored generated
configuration. These commands require explicit local credentials and are not
run by `make check`. `make infra-plan ENV=prod` produces the production plan,
but production apply and deployment are deliberately unavailable until the
controlled delivery phase. On 2026-10-15, the manual workflow provisioned,
deployed, exercised, destroyed, and recreated development successfully; a real
production plan was also reviewed without being applied. This validates the
manual path but does not provide shared state or automated deployment.

## Promotion requirements

Before promotion to `main`:

- required CI checks must pass,
- infrastructure changes must have a reviewed plan,
- required secrets and environment approvals must be configured,
- migrations or compatibility concerns must be documented, and
- smoke-test expectations must be known.

The exact GitHub protection rules and deployment approval policy are not
configured by the repository and must not be assumed to exist.

## Credentials and permissions

CI/CD credentials should:

- use GitHub environment or repository secrets,
- have the smallest practical Cloudflare permissions,
- separate development and production access where feasible,
- avoid plaintext Terraform variables and state exposure, and
- support rotation without changing application code.

Production deployment should use a protected GitHub environment if that feature
fits the selected repository plan.

## Failure and recovery

Deployment is not complete merely because an automation job succeeds. The
delivery phase must define:

- what smoke-test failure does to the workflow,
- how the previous Worker version can be restored,
- how infrastructure apply failures are surfaced,
- which operations require manual intervention, and
- how a failed promotion is documented.

Rollback behavior remains TBD until deployable application and infrastructure
artifacts exist.
