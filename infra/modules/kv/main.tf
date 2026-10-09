resource "cloudflare_workers_kv_namespace" "this" {
  account_id = var.cloudflare_account_id
  title      = var.title
}
