variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the Access application."
  type        = string
}

variable "name" {
  description = "Human-readable Access application name."
  type        = string
}

variable "hostname" {
  description = "Worker hostname whose feature flag routes Access protects."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9.-]+$", var.hostname))
    error_message = "The Access hostname must be a lowercase hostname without a scheme or path."
  }
}

variable "service_token_ids" {
  description = "Bootstrap-created Access Service Tokens allowed to call the API."
  type        = set(string)

  validation {
    condition = length(var.service_token_ids) > 0 && alltrue([
      for id in var.service_token_ids : can(regex("^[0-9a-f-]{36}$", id))
    ])
    error_message = "At least one Access Service Token ID must be provided and every ID must be a UUID."
  }
}

variable "allowed_emails" {
  description = "Human identities allowed through Cloudflare Access."
  type        = set(string)
  default     = []

  validation {
    condition = alltrue([
      for email in var.allowed_emails : can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", email))
    ])
    error_message = "Every allowed Access identity must be an email address."
  }
}
