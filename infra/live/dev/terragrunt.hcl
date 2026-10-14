include "root" {
  path = find_in_parent_folders("root.hcl")
}

inputs = {
  flags_kv_title = "edgeflags-dev-flags"
}
