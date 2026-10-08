provider "cloudflare" {}

module "flags_kv" {
  source = "../../modules/kv"

  cloudflare_account_id = var.cloudflare_account_id
  title                 = var.flags_kv_title
}
