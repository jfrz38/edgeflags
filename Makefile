.DEFAULT_GOAL := help

MISE ?= mise
ENV ?= dev
INFRA_ENVIRONMENTS := dev prod
RCLONE := $(MISE) exec -- rclone
TERRAFORM := $(MISE) exec -- terraform
TERRAGRUNT := $(MISE) exec -- terragrunt
TRIVY := $(MISE) exec -- trivy
VALIDATION_CACHE := $(abspath infra/.terragrunt-cache/validation/$(ENV))

.PHONY: help
help: ## Show available targets
	@$(MISE) exec -- node -e "const fs = require('node:fs'); for (const line of fs.readFileSync(process.argv[1], 'utf8').split(/\\r?\\n/)) { const match = line.match(/^([a-zA-Z_-]+):.*?## (.*)$$/); if (match) console.log(' ' + match[1].padEnd(20) + '  ' + match[2]); }" "$(firstword $(MAKEFILE_LIST))"

.PHONY: install
install: ## Install application dependencies from the lockfile
	$(MISE) exec -- pnpm --dir app install --frozen-lockfile

.PHONY: dev
dev: ## Start the Worker locally
	$(MISE) run dev

.PHONY: architecture format format-check lint typecheck test worker-infra-test security pre-commit check
architecture: ## Check application architecture boundaries
	$(MISE) run architecture

format: ## Format application files
	$(MISE) run format

format-check: ## Check application formatting without changing files
	$(MISE) exec -- pnpm --dir app run format-check

lint: ## Lint application files
	$(MISE) run lint

typecheck: ## Type-check the Worker and tests
	$(MISE) run typecheck

test: ## Run application tests
	$(MISE) run test

worker-infra-test: ## Test Terraform output binding with the local Worker and KV runtime
	$(MISE) exec -- node --test infra/scripts/tests/*.test.mjs
	$(MISE) exec -- node infra/scripts/test-dev-worker-binding.mjs

security: ## Scan dependencies, secrets, and infrastructure for actionable findings
	$(TRIVY) filesystem --disable-telemetry --no-progress --scanners vuln --include-dev-deps --ignore-unfixed --severity HIGH,CRITICAL --exit-code 1 app/pnpm-lock.yaml
	$(TRIVY) filesystem --disable-telemetry --no-progress --scanners secret --skip-files .env --exit-code 1 .
	$(TRIVY) filesystem --disable-telemetry --no-progress --scanners misconfig --severity HIGH,CRITICAL --exit-code 1 infra

pre-commit: ## Run fast checks before creating a commit
	$(MAKE) lint

check: ## Run application and infrastructure checks
	$(MAKE) architecture
	$(MAKE) format-check
	$(MAKE) lint
	$(MAKE) typecheck
	$(MAKE) test
	$(MAKE) worker-infra-test
	$(MAKE) infra-check
	$(MAKE) security

.PHONY: check-infra-env check-mutable-infra-env check-state-env check-state-backup-env check-cloudflare-account check-cloudflare-token
check-infra-env:
	@if [ "$(ENV)" != "dev" ] && [ "$(ENV)" != "prod" ]; then printf '%s\n' "ENV must be one of: $(INFRA_ENVIRONMENTS)"; exit 1; fi

check-mutable-infra-env: check-infra-env
	@if [ "$(ENV)" != "dev" ]; then printf '%s\n' "Mutable infrastructure commands are limited to ENV=dev"; exit 1; fi

check-state-env: check-infra-env
	@if [ -z "$$CLOUDFLARE_ACCOUNT_ID" ] || [ -z "$$AWS_ACCESS_KEY_ID" ] || [ -z "$$AWS_SECRET_ACCESS_KEY" ]; then printf '%s\n' "CLOUDFLARE_ACCOUNT_ID, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are required for remote state"; exit 1; fi

check-state-backup-env:
	@if [ -z "$$R2_BACKUP_ACCESS_KEY_ID" ] || [ -z "$$R2_BACKUP_SECRET_ACCESS_KEY" ]; then printf '%s\n' "R2_BACKUP_ACCESS_KEY_ID and R2_BACKUP_SECRET_ACCESS_KEY are required for state backups"; exit 1; fi

check-cloudflare-account:
	@if [ -z "$$CLOUDFLARE_ACCOUNT_ID" ]; then printf '%s\n' "CLOUDFLARE_ACCOUNT_ID is required"; exit 1; fi

check-cloudflare-token:
	@if [ -z "$$CLOUDFLARE_API_TOKEN" ]; then printf '%s\n' "CLOUDFLARE_API_TOKEN is required"; exit 1; fi

.PHONY: infra-init infra-format infra-validate infra-test infra-check infra-plan infra-plan-summary infra-show infra-apply infra-destroy infra-state-bootstrap infra-state-backup-local infra-state-migrate infra-state-backup
infra-init: check-state-env ## Initialize the remote R2 backend for ENV (dev or prod)
	$(TERRAGRUNT) --working-dir "infra/live/$(ENV)" run --tf-path terraform -- init

infra-format: ## Format Terraform and Terragrunt files
	$(TERRAFORM) fmt -recursive infra
	$(MISE) exec -- terragrunt --working-dir infra hcl fmt

infra-validate: check-infra-env ## Validate infrastructure for ENV without contacting the remote backend
	$(TERRAGRUNT) --working-dir "infra/live/$(ENV)" run --download-dir "$(VALIDATION_CACHE)" --tf-path terraform -- init -backend=false
	$(TERRAGRUNT) --working-dir "infra/live/$(ENV)" run --download-dir "$(VALIDATION_CACHE)" --no-auto-init --tf-path terraform -- validate

infra-test: ## Test shared infrastructure composition without Cloudflare credentials
	$(TERRAFORM) -chdir=infra/modules/environment init -backend=false -lockfile=readonly
	$(TERRAFORM) -chdir=infra/modules/environment test

infra-check: ## Check and test Terraform and Terragrunt configuration
	$(TERRAFORM) fmt -check -recursive infra
	$(MISE) exec -- terragrunt --working-dir infra hcl fmt --check
	$(MISE) exec -- terragrunt --working-dir infra/live hcl validate
	$(MAKE) infra-validate ENV=dev
	$(MAKE) infra-validate ENV=prod
	$(MAKE) infra-test

infra-plan: check-infra-env ## Create a plan for ENV (requires Cloudflare variables)
	$(MAKE) infra-init ENV=$(ENV)
	$(TERRAGRUNT) --working-dir "infra/live/$(ENV)" run --tf-path terraform -- plan -out="$(abspath infra/live/$(ENV)/edgeflags-$(ENV).tfplan)"

infra-plan-summary: check-infra-env ## Write a secret-safe Markdown summary of the saved plan
	@test -f "infra/live/$(ENV)/edgeflags-$(ENV).tfplan" || { printf '%s\n' "No saved plan exists for ENV=$(ENV)"; exit 1; }
	$(TERRAGRUNT) --working-dir "infra/live/$(ENV)" run --tf-path terraform -- show -json "$(abspath infra/live/$(ENV)/edgeflags-$(ENV).tfplan)" | $(MISE) exec -- node infra/scripts/summarize-plan.mjs

infra-show: check-infra-env ## Show the saved plan for ENV
	$(TERRAGRUNT) --working-dir "infra/live/$(ENV)" run --tf-path terraform -- show "$(abspath infra/live/$(ENV)/edgeflags-$(ENV).tfplan)"

infra-apply: check-mutable-infra-env ## Apply the reviewed development plan
	$(TERRAGRUNT) --working-dir infra/live/dev run --tf-path terraform -- apply "$(abspath infra/live/dev/edgeflags-dev.tfplan)"

infra-destroy: check-mutable-infra-env ## Destroy development resources after confirmation
	$(TERRAGRUNT) --working-dir infra/live/dev run --tf-path terraform -- destroy

.PHONY: configure-worker deploy smoke
configure-worker: check-infra-env ## Generate ignored Wrangler configuration for ENV
	$(MISE) exec -- node infra/scripts/configure-worker.mjs "$(ENV)"

deploy: check-mutable-infra-env configure-worker ## Deploy the development Worker with its provisioned KV binding
	$(MISE) exec -- pnpm --dir app exec wrangler deploy --env "$(ENV)" --config "wrangler.$(ENV).toml"

smoke: check-mutable-infra-env ## Exercise health and a disposable flag against BASE_URL
	@if [ -z "$(BASE_URL)" ]; then printf '%s\n' "BASE_URL is required"; exit 1; fi
	BASE_URL="$(BASE_URL)" $(MISE) exec -- node infra/scripts/smoke-worker.mjs

infra-state-bootstrap: check-infra-env check-cloudflare-account check-cloudflare-token ## Create the R2 state bucket for ENV (one-time bootstrap)
	$(MISE) exec -- pnpm --dir app exec wrangler r2 bucket create "edgeflags-terraform-state-$(ENV)"

infra-state-backup-local: check-mutable-infra-env ## Copy the pre-migration local development state to an ignored backup
	@test -f "infra/live/dev/terraform.tfstate" || { printf '%s\n' "No local development state exists"; exit 1; }
	@mkdir -p "infra/live/dev/state-backups"
	@cp "infra/live/dev/terraform.tfstate" "infra/live/dev/state-backups/pre-r2-$$(date -u +%Y%m%dT%H%M%SZ).tfstate"

infra-state-migrate: check-mutable-infra-env check-state-env ## Migrate the existing development state to R2
	$(TERRAGRUNT) --working-dir infra/live/dev run --tf-path terraform -- init -migrate-state

infra-state-backup: check-mutable-infra-env check-state-env check-state-backup-env ## Snapshot remote development state to a timestamped R2 object
	@$(MAKE) infra-init ENV=dev
	@tmp_file=$$(mktemp); trap 'rm -f "$$tmp_file"' EXIT; \
	$(TERRAGRUNT) --working-dir infra/live/dev run --tf-path terraform -- state pull > "$$tmp_file" && \
	RCLONE_S3_PROVIDER=Cloudflare \
	RCLONE_S3_ACCESS_KEY_ID="$$R2_BACKUP_ACCESS_KEY_ID" \
	RCLONE_S3_SECRET_ACCESS_KEY="$$R2_BACKUP_SECRET_ACCESS_KEY" \
	RCLONE_S3_ENDPOINT="https://$$CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com" \
	$(RCLONE) copyto "$$tmp_file" ":s3:edgeflags-terraform-state-dev/backups/$$(date -u +%Y%m%dT%H%M%SZ).tfstate" \
		--s3-no-check-bucket
