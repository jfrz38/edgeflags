output "id" {
  description = "Cloudflare KV namespace identifier."
  value       = cloudflare_workers_kv_namespace.this.id
}

output "title" {
  description = "Cloudflare KV namespace title."
  value       = cloudflare_workers_kv_namespace.this.title
}
