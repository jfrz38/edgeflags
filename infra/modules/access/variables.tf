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

variable "service_token_id" {
  description = "Bootstrap-created Access Service Token allowed to call the API."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f-]{36}$", var.service_token_id))
    error_message = "The Access Service Token ID must be a UUID."
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
