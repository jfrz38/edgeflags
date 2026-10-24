output "flags_kv_namespace_id" {
  description = "KV namespace ID consumed by the environment Worker binding."
  value       = module.flags_kv.id
}

output "flags_kv_namespace_title" {
  description = "Environment KV namespace title."
  value       = module.flags_kv.title
}

output "access_application_id" {
  description = "Access application ID, or null while Access is disabled."
  value       = var.access_enabled ? module.access[0].application_id : null
}

output "access_audience" {
  description = "Access application audience, or null while Access is disabled."
  value       = var.access_enabled ? module.access[0].audience : null
}

output "access_protected_paths" {
  description = "Access-protected Worker paths, or an empty list while disabled."
  value       = var.access_enabled ? module.access[0].protected_paths : []
}
