.DEFAULT_GOAL := help

MISE ?= mise

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

.PHONY: infra-init infra-format infra-check infra-plan infra-show infra-apply infra-destroy
infra-init: ## Initialize Terraform for the development environment
	$(MISE) run infra-init

infra-format: ## Format Terraform files
	$(MISE) run infra-format

infra-check: ## Check Terraform formatting and configuration
	$(MISE) run infra-format-check
	$(MAKE) infra-init
	$(MISE) run infra-validate

infra-plan: ## Create the development plan (requires Cloudflare variables)
	$(MAKE) infra-init
	$(MISE) run infra-plan

infra-show: ## Show the saved development plan
	$(MISE) run infra-show

infra-apply: ## Apply the saved development plan
	$(MISE) run infra-apply

infra-destroy: ## Destroy development resources after confirmation
	$(MISE) run infra-destroy

.PHONY: configure-dev deploy-dev
configure-dev: ## Generate the ignored Wrangler dev configuration from Terraform state
	$(MISE) exec -- node infra/scripts/configure-dev-worker.mjs

deploy-dev: configure-dev ## Deploy the Worker and bind the provisioned development KV
	$(MISE) exec -- pnpm --dir app exec wrangler deploy --env dev --config wrangler.dev.toml
