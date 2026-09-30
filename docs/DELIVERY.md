# EdgeFlags Delivery

This document defines the target branch, environment, and delivery model. No CI
or deployment automation exists yet.

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

The target infrastructure contains `dev` and `prod` environments.

| Environment | Purpose | Branch relationship |
| --- | --- | --- |
| `dev` | Integration and deployed experiments | Associated with `develop`; the exact deployment trigger is TBD in Phase 7 |
| `prod` | Stable release behavior | Deployed from `main` after promotion |

Separating these environments is intentionally educational even though the
application is small. Both must remain inside the project's default free-tier
constraints.

## Pull request validation

The target pull request pipeline will run applicable checks such as:

```text
format
lint
typecheck
tests
security scanning
terraform formatting and validation
Terragrunt plan
```

Not every check will exist from the start. Each phase adds checks only after the
corresponding local task is working and documented.

Infrastructure plans must be reviewable and must not expose secret values.

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

## Promotion requirements

Before promotion to `main`:

- required CI checks must pass,
- infrastructure changes must have a reviewed plan,
- required secrets and environment approvals must be configured,
- migrations or compatibility concerns must be documented, and
- smoke-test expectations must be known.

The exact GitHub protection rules and approval policy will be implemented and
documented with CI/CD rather than assumed to exist now.

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
