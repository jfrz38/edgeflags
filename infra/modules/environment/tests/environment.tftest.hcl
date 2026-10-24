mock_provider "cloudflare" {
  override_during = apply

  mock_resource "cloudflare_workers_kv_namespace" {
    defaults = {
      id = "abcdef0123456789abcdef0123456789"
    }
  }
}

run "applies_development_environment_with_mock_provider" {
  command = apply

  variables {
    cloudflare_account_id = "0123456789abcdef0123456789abcdef"
    environment           = "dev"
    flags_kv_title        = "edgeflags-dev-flags"
  }

  assert {
    condition     = output.flags_kv_namespace_title == "edgeflags-dev-flags"
    error_message = "The development KV title must be propagated through the environment composition."
  }

  assert {
    condition     = output.flags_kv_namespace_id == "abcdef0123456789abcdef0123456789"
    error_message = "The mocked KV namespace ID must be exposed to Worker configuration."
  }
}

run "plans_production_environment" {
  command = plan

  variables {
    cloudflare_account_id = "0123456789abcdef0123456789abcdef"
    environment           = "prod"
    flags_kv_title        = "edgeflags-prod-flags"
  }

  assert {
    condition     = output.flags_kv_namespace_title == "edgeflags-prod-flags"
    error_message = "The production KV title must be propagated through the environment composition."
  }
}

run "rejects_invalid_account_id" {
  command = plan

  variables {
    cloudflare_account_id = "invalid-account-id"
    environment           = "dev"
    flags_kv_title        = "edgeflags-dev-flags"
  }

  expect_failures = [var.cloudflare_account_id]
}

run "plans_access_protection_with_mock_provider" {
  command = apply

  variables {
    cloudflare_account_id = "0123456789abcdef0123456789abcdef"
    environment           = "dev"
    flags_kv_title        = "edgeflags-dev-flags"
    access_enabled        = true
    access_hostname       = "edgeflags-dev.example.workers.dev"
    access_service_token_ids = [
      "12345678-1234-1234-1234-123456789abc",
      "87654321-4321-4321-4321-cba987654321"
    ]
    access_allowed_emails = ["operator@example.com"]
  }

  assert {
    condition     = output.access_application_id != null
    error_message = "Enabling Access must add an environment Access application."
  }

  assert {
    condition = tolist(output.access_protected_paths) == tolist([
      "edgeflags-dev.example.workers.dev/flags/*",
      "edgeflags-dev.example.workers.dev/evaluate/*"
    ])
    error_message = "Access must protect management and evaluation without covering the public health root."
  }
}
