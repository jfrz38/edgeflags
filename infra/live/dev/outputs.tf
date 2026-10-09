output "flags_kv_namespace_id" {
  description = "KV namespace ID consumed by the development Worker binding."
  value       = module.flags_kv.id
}

output "flags_kv_namespace_title" {
  description = "Development KV namespace title."
  value       = module.flags_kv.title
}
