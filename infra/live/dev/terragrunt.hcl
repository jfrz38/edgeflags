include "root" {
  path = find_in_parent_folders("root.hcl")
}

inputs = {
  environment              = "dev"
  flags_kv_title           = "edgeflags-dev-flags"
  access_enabled           = get_env("ACCESS_ENABLED", "false") == "true"
  access_hostname          = get_env("ACCESS_HOSTNAME", "not-configured.invalid")
  access_service_token_ids = compact([for id in split(",", get_env("ACCESS_SERVICE_TOKEN_IDS", "00000000-0000-0000-0000-000000000000")) : trimspace(id)])
  access_allowed_emails    = compact([for email in split(",", get_env("ACCESS_ALLOWED_EMAILS", "")) : trimspace(email)])
}
