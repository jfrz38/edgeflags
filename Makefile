.DEFAULT_GOAL := help

MISE ?= mise
ENV ?= dev
INFRA_ENVIRONMENTS := dev prod
TERRAFORM := $(MISE) exec -- terraform
TERRAGRUNT := $(MISE) exec -- terragrunt

.PHONY: help
help: ## Show available targets
	@$(MISE) exec -- node -e "const fs = require('node:fs'); for (const line of fs.readFileSync(process.argv[1], 'utf8').split(/\\r?\\n/)) { const match = line.match(/^([a-zA-Z_-]+):.*?## (.*)$$/); if (match) console.log(' ' + match[1].padEnd(20) + '  ' + match[2]); }" "$(firstword $(MAKEFILE_LIST))"

.PHONY: install
install: ## Install application dependencies from the lockfile
	$(MISE) exec -- pnpm --dir app install --frozen-lockfile

.PHONY: dev
dev: ## Start the Worker locally
	$(MISE) run dev

.PHONY: architecture format lint typecheck test pre-commit check
architecture: ## Check application architecture boundaries
	$(MISE) run architecture

format: ## Format application files
	$(MISE) run format

lint: ## Lint application files
	$(MISE) run lint

typecheck: ## Type-check the Worker and tests
	$(MISE) run typecheck

test: ## Run application tests
	$(MISE) run test

pre-commit: ## Run fast checks before creating a commit
	$(MAKE) lint

check: ## Run application and infrastructure checks
	$(MAKE) architecture
	$(MAKE) lint
	$(MAKE) typecheck
	$(MAKE) test
	$(MAKE) infra-check

.PHONY: check-infra-env check-mutable-infra-env
check-infra-env:
	@if [ "$(ENV)" != "dev" ] && [ "$(ENV)" != "prod" ]; then printf '%s\n' "ENV must be one of: $(INFRA_ENVIRONMENTS)"; exit 1; fi

check-mutable-infra-env: check-infra-env
	@if [ "$(ENV)" != "dev" ]; then printf '%s\n' "Mutable infrastructure commands are limited to ENV=dev"; exit 1; fi

.PHONY: infra-init infra-format infra-validate infra-check infra-plan infra-show infra-apply infra-destroy
infra-init: check-infra-env ## Initialize Terragrunt for ENV (dev or prod)
	$(TERRAGRUNT) --working-dir "infra/live/$(ENV)" run --tf-path terraform -- init

infra-format: ## Format Terraform and Terragrunt files
	$(TERRAFORM) fmt -recursive infra
	$(MISE) exec -- terragrunt --working-dir infra hcl fmt

infra-validate: infra-init ## Validate infrastructure for ENV (dev or prod)
	$(TERRAGRUNT) --working-dir "infra/live/$(ENV)" run --tf-path terraform -- validate

infra-check: ## Check Terraform formatting and configuration
	$(TERRAFORM) fmt -check -recursive infra
	$(MISE) exec -- terragrunt --working-dir infra hcl fmt --check
	$(MISE) exec -- terragrunt --working-dir infra/live hcl validate
	$(MAKE) infra-validate ENV=dev
	$(MAKE) infra-validate ENV=prod

infra-plan: check-infra-env ## Create a plan for ENV (requires Cloudflare variables)
	$(MAKE) infra-init ENV=$(ENV)
	$(TERRAGRUNT) --working-dir "infra/live/$(ENV)" run --tf-path terraform -- plan -out="$(abspath infra/live/$(ENV)/edgeflags-$(ENV).tfplan)"

infra-show: check-infra-env ## Show the saved plan for ENV
	$(TERRAGRUNT) --working-dir "infra/live/$(ENV)" run --tf-path terraform -- show "$(abspath infra/live/$(ENV)/edgeflags-$(ENV).tfplan)"

infra-apply: check-mutable-infra-env ## Apply the reviewed development plan
	$(TERRAGRUNT) --working-dir infra/live/dev run --tf-path terraform -- apply "$(abspath infra/live/dev/edgeflags-dev.tfplan)"

infra-destroy: check-mutable-infra-env ## Destroy development resources after confirmation
	$(TERRAGRUNT) --working-dir infra/live/dev run --tf-path terraform -- destroy

.PHONY: configure-dev deploy-dev
configure-dev: ## Generate the ignored Wrangler dev configuration from Terragrunt-managed state
	$(MISE) exec -- node infra/scripts/configure-dev-worker.mjs

deploy-dev: configure-dev ## Deploy the Worker and bind the provisioned development KV
	$(MISE) exec -- pnpm --dir app exec wrangler deploy --env dev --config wrangler.dev.toml
