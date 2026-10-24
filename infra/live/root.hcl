terraform {
  source = "${get_repo_root()}//infra/modules/environment"
}

remote_state {
  backend = "s3"

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }

  config = {
    bucket                      = "edgeflags-terraform-state-${basename(get_original_terragrunt_dir())}"
    key                         = "terraform.tfstate"
    region                      = "auto"
    endpoint                    = "https://${get_env("CLOUDFLARE_ACCOUNT_ID", "00000000000000000000000000000000")}.r2.cloudflarestorage.com"
    encrypt                     = true
    use_lockfile                = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}
