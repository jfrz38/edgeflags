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

.PHONY: format lint typecheck test pre-commit check
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

check: ## Run lint, type-checking, and tests
	$(MAKE) lint
	$(MAKE) typecheck
	$(MAKE) test
