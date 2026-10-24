output "application_id" {
  description = "Cloudflare Access application ID."
  value       = cloudflare_zero_trust_access_application.this.id
}

output "audience" {
  description = "Audience assigned to the Cloudflare Access application."
  value       = cloudflare_zero_trust_access_application.this.aud
}

output "protected_paths" {
  description = "Worker paths protected by this Access application."
  value       = local.protected_paths
}
