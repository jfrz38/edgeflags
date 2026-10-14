provider "cloudflare" {}

module "flags_kv" {
  source = "../kv"

  cloudflare_account_id = var.cloudflare_account_id
  title                 = var.flags_kv_title
}
