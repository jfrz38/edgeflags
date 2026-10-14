output "flags_kv_namespace_id" {
  description = "KV namespace ID consumed by the environment Worker binding."
  value       = module.flags_kv.id
}

output "flags_kv_namespace_title" {
  description = "Environment KV namespace title."
  value       = module.flags_kv.title
}
