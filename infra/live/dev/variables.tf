variable "cloudflare_account_id" {
  description = "Cloudflare account that owns EdgeFlags development resources."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.cloudflare_account_id))
    error_message = "The Cloudflare account ID must be a 32-character lowercase hexadecimal value."
  }
}

variable "flags_kv_title" {
  description = "Title of the development feature flag KV namespace."
  type        = string
  default     = "edgeflags-dev-flags"
}
