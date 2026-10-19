# EdgeFlags Delivery

This document defines the branch, environment, and delivery model. Pull request
CI, environment-scoped remote development plans, R2 state, and automatic
development deployments are active. Cloudflare Access integration is implemented
behind coordinated activation while its remote identity behavior is validated.

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
| `dev` | Integration and deployed experiments | Deploys each integrated push to `develop` |
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
These credential-free jobs do not contact Cloudflare. They also do not publish
an automated cost estimate because Infracost does not price the current
Cloudflare resources. Cloudflare's documented free allowances and the static
inventory remain the applicable cost review.

The workflow contains an environment-scoped remote development plan job. It runs only for
same-repository pull requests after `R2_STATE_ENABLED=true` is configured, uses
the `dev-plan` GitHub environment, and emits only create/update/replace/delete
counts. The saved plan is not published or reused after merge.

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

Development deploys on every push integrated into `develop` and supports a
controlled `workflow_dispatch` rerun. `DEV_CD_ENABLED=true` is configured and
the workflow serializes all deployments without cancelling one in progress.

## Development deployment flow

Development follows:

```text
push to develop or controlled rerun
        |
        v
required checks
        |
        v
R2 state backup
        |
        v
new saved plan -> exact plan apply
        |
        v
Worker deploy -> disposable-flag smoke test
```

Terraform owns each KV namespace. Wrangler owns Worker deployment and reads the
development namespace ID from Terragrunt output through an ignored generated
configuration. Production apply and deployment remain unavailable until API
authentication is remotely validated.

## Cloudflare Access activation

Access infrastructure and Worker enforcement share `ACCESS_ENABLED`. Keep it
false until the development Service Token, repository variables, authorization
policy, and smoke-test secrets are configured. Activation requires:

- repository variables `DEV_ACCESS_HOSTNAME`, comma-separated
  `DEV_ACCESS_SERVICE_TOKEN_IDS`, `DEV_ACCESS_ISSUER`, optional
  `DEV_ACCESS_ALLOWED_EMAILS`, and `ACCESS_ENABLED=true`;
- GitHub `dev` secrets `ACCESS_CLIENT_ID`, `ACCESS_CLIENT_SECRET`, and
  `AUTHORIZATION_POLICY`.

Terraform manages the Access application and policies, but not the Service
Token. Creating that token with Terraform would persist its one-time Client
Secret in R2 state. `make access-token-create ENV=dev` performs the explicit
bootstrap from a trusted terminal using an API token with `Access: Service
Tokens Write`. Once active, the smoke test authenticates every request with that
Service Token.

Create the initial token, configure its resource ID, Client ID authorization
principal, smoke-test credentials, and hostname before enabling the normal
deployment workflow. Additional clients use separate Service Tokens so they can
be authorized, rotated, and revoked independently.

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

`dev-plan` uses bucket-scoped R2 credentials and a read-only Cloudflare plan
token. `dev` uses its own R2 credentials, a Cloudflare infrastructure/deployment
token, and a separate R2 backup token. `CLOUDFLARE_ACCOUNT_ID` and `DEV_BASE_URL`
are non-secret environment variables. No production deployment credentials are
configured during this iteration.

When Access is enabled, the plan token also needs Access Apps and Policies Read,
and the deployment token needs Access Apps and Policies Write. Service Token
credentials remain separate from Cloudflare API tokens and R2 credentials.

Production deployment should use a protected GitHub environment if that feature
fits the selected repository plan.

## Failure and recovery

The deployment chain stops at the first failed prerequisite: backup failure
prevents planning, plan failure prevents apply, apply failure prevents Worker
deployment, and deploy failure prevents smoke testing. A smoke failure marks the
deployment failed and preserves the evidence in the workflow summary.

Worker recovery is an explicit redeploy of a previously successful commit after
checking compatibility with the applied infrastructure. Terraform is never
rolled back automatically because reversing infrastructure can destroy data or
worsen a partial apply. Operators inspect remote state and Cloudflare before
retrying or applying a forward fix. `infra-destroy` is never run by CI.
