locals {
  protected_paths = [
    "${var.hostname}/flags/*",
    "${var.hostname}/evaluate/*"
  ]
}

resource "cloudflare_zero_trust_access_application" "this" {
  account_id                = var.cloudflare_account_id
  name                      = var.name
  type                      = "self_hosted"
  domain                    = local.protected_paths[0]
  session_duration          = "24h"
  service_auth_401_redirect = true

  destinations = [
    for path in local.protected_paths : {
      type = "public"
      uri  = path
    }
  ]

  policies = concat(
    [
      {
        name       = "Allow EdgeFlags service token"
        decision   = "non_identity"
        precedence = 1
        include = [
          {
            service_token = {
              token_id = var.service_token_id
            }
          }
        ]
      }
    ],
    length(var.allowed_emails) == 0 ? [] : [
      {
        name       = "Allow EdgeFlags operators"
        decision   = "allow"
        precedence = 2
        include = [
          for email in sort(tolist(var.allowed_emails)) : {
            email = {
              email = email
            }
          }
        ]
      }
    ]
  )
}
