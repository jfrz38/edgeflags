# Architecture Decision Records

EdgeFlags uses Architecture Decision Records (ADRs) to document decisions that are intentionally made as part of the learning process.

The goal is not to document every implementation detail. An ADR should be created when a decision has meaningful trade-offs, constrains future work, or teaches something worth preserving.

## Naming

Use a monotonically increasing number followed by a short kebab-case title:

```text
0001-use-cloudflare-workers.md
0002-use-kv-for-feature-flags.md
0003-use-terraform-and-terragrunt.md
```

## Status

Use one of these statuses:

- Proposed
- Accepted
- Superseded
- Rejected

If an ADR supersedes another decision, link both records.

## Suggested workflow

1. Copy `template.md`.
2. Describe the problem before describing the solution.
3. Record the alternatives that were seriously considered.
4. Explain the trade-offs rather than only the benefits.
5. Record consequences and follow-up experiments.
6. Commit the ADR with the implementation or infrastructure change that makes the decision real.

The ADR history should remain in the repository even when a decision changes so the evolution of the project is understandable later.

## Records

- [ADR 0001: Use versioned Cloudflare KV storage](0001-use-versioned-cloudflare-kv-storage.md) - Accepted
- [ADR 0002: Manage Cloudflare infrastructure with Terraform](0002-manage-cloudflare-infrastructure-with-terraform.md) - Accepted
