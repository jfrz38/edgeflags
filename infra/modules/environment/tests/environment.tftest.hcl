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
    flags_kv_title        = "edgeflags-dev-flags"
  }

  expect_failures = [var.cloudflare_account_id]
}
