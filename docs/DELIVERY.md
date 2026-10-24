# EdgeFlags Delivery

This document defines the branch, environment, and delivery model. Pull request
CI, environment-scoped remote development plans, R2 state, and automatic
development deployments are active. Cloudflare Access and EdgeFlags authorization
are active and remotely validated in development. The production plan and
deployment workflows are implemented but remain disabled pending bootstrap and
the first approved promotion.

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

Pull requests targeting `main` can also run an isolated production plan after
`PROD_R2_STATE_ENABLED=true` is configured. This job uses the `prod-plan`
environment, read-only Cloudflare authority, production-only R2 credentials, and
publishes only action counts. It never receives deployment, backup, Worker
secret, or Access Client Secret credentials.

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
configuration. Production uses the same ordering in a separate workflow after a
merge to `main`. Its `prod` GitHub environment must require approval. The
workflow always enables Access, backs up existing state, creates and applies a
fresh exact plan, deploys `edgeflags-prod`, and verifies both unauthenticated
denial and an authenticated disposable-flag lifecycle. The first run permits the
absence of a state object because no production resources have yet been applied.

Production remains inert while the repository variable `PROD_CD_ENABLED` is not
`true`. Workflow dispatch follows the same gate and approval; it is a controlled
rerun, not a bypass.

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

## Production bootstrap

Production starts with one dedicated Service Token and no human identities. Use
the generated `edgeflags-prod.<workers-subdomain>.workers.dev` hostname and keep
all bootstrap resources within the account's current free allowances.

Before enabling either production workflow:

1. Create `edgeflags-terraform-state-prod` with
   `make infra-state-bootstrap ENV=prod` and create independent bucket-scoped
   credentials for planning, deployment state, and backup maintenance.
2. Create `edgeflags-prod-smoke` from a trusted terminal with
   `make access-token-create ENV=prod`. Store its resource ID separately from
   its Client ID and one-time Client Secret.
3. Create `prod-plan` with `TERRAFORM_STATE_ACCESS_KEY_ID`,
   `TERRAFORM_STATE_SECRET_ACCESS_KEY`, and a read-only
   `CLOUDFLARE_PLAN_API_TOKEN`.
4. Create protected `prod` with the state credentials,
   `R2_BACKUP_ACCESS_KEY_ID`, `R2_BACKUP_SECRET_ACCESS_KEY`,
   `CLOUDFLARE_DEPLOY_API_TOKEN`, `AUTHORIZATION_POLICY`, `ACCESS_CLIENT_ID`, and
   `ACCESS_CLIENT_SECRET`.
5. Configure `PROD_ACCESS_HOSTNAME`, `PROD_ACCESS_ISSUER`,
   `PROD_ACCESS_SERVICE_TOKEN_IDS`, and `PROD_BASE_URL`. The authorization policy
   grants the one `service:<client-id>` principal `flags:read`, `flags:write`,
   and `flags:evaluate`.
6. Validate current R2, Workers, KV, and Access free allowances, then set
   `PROD_R2_STATE_ENABLED=true`. Set `PROD_CD_ENABLED=true` only after reviewing
   the production plan and completing the state lock and restore exercises.

Neither workflow creates GitHub environments, credentials, Service Tokens, or
required-reviewer rules. These are explicit account and repository bootstrap
operations.

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

`dev-plan` and `prod-plan` use environment-specific bucket-scoped R2 credentials
and read-only Cloudflare plan tokens. `dev` and `prod` use isolated R2 state,
Cloudflare infrastructure/deployment, R2 backup, and Access Service Token
credentials. `CLOUDFLARE_ACCOUNT_ID` and environment base URLs are non-secret.
Production bootstrap is not complete merely because the workflow files exist.

When Access is enabled, the plan token also needs Access Apps and Policies Read,
and the deployment token needs Access Apps and Policies Write. Service Token
credentials remain separate from Cloudflare API tokens and R2 credentials.

Production deployment requires a protected GitHub environment with an explicit
approval rule. If the selected repository plan cannot provide that control,
`PROD_CD_ENABLED` must remain false.

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
