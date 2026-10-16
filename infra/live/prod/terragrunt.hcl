include "root" {
  path = find_in_parent_folders("root.hcl")
}

inputs = {
  environment             = "prod"
  flags_kv_title          = "edgeflags-prod-flags"
  access_enabled          = get_env("ACCESS_ENABLED", "false") == "true"
  access_hostname         = get_env("ACCESS_HOSTNAME", "not-configured.invalid")
  access_service_token_id = get_env("ACCESS_SERVICE_TOKEN_ID", "00000000-0000-0000-0000-000000000000")
  access_allowed_emails   = compact([for email in split(",", get_env("ACCESS_ALLOWED_EMAILS", "")) : trimspace(email)])
}
