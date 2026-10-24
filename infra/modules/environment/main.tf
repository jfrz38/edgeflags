provider "cloudflare" {}

module "flags_kv" {
  source = "../kv"

  cloudflare_account_id = var.cloudflare_account_id
  title                 = var.flags_kv_title
}

module "access" {
  count  = var.access_enabled ? 1 : 0
  source = "../access"

  cloudflare_account_id = var.cloudflare_account_id
  name                  = "EdgeFlags ${var.environment} API"
  hostname              = var.access_hostname
  service_token_ids     = var.access_service_token_ids
  allowed_emails        = var.access_allowed_emails
}
