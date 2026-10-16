variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the environment resources."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.cloudflare_account_id))
    error_message = "The Cloudflare account ID must be a 32-character lowercase hexadecimal value."
  }
}

variable "flags_kv_title" {
  description = "Title of the environment feature flag KV namespace."
  type        = string
}

variable "environment" {
  description = "EdgeFlags environment name."
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "The environment must be dev or prod."
  }
}

variable "access_enabled" {
  description = "Whether Cloudflare Access resources are provisioned."
  type        = bool
  default     = false
}

variable "access_hostname" {
  description = "Worker hostname protected by Cloudflare Access when enabled."
  type        = string
  default     = "not-configured.invalid"
}

variable "access_service_token_id" {
  description = "Bootstrap-created Access Service Token ID used by smoke tests."
  type        = string
  default     = "00000000-0000-0000-0000-000000000000"
}

variable "access_allowed_emails" {
  description = "Human identities allowed through Cloudflare Access."
  type        = set(string)
  default     = []
}
