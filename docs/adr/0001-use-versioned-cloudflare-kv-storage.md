# ADR 0001: Use versioned Cloudflare KV storage

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

The in-memory repository used for the core feature flag behavior loses data when
an isolate is replaced and does not share state between isolates. Phase 3 needs
persistent storage while preserving the existing application port and keeping
Cloudflare APIs outside the domain and application layers.

KV is eventually consistent. It also stores opaque values, so the application
must be able to distinguish supported persisted data from corrupt or future
representations.

## Decision

Use a Cloudflare KV namespace bound as `FLAGS_KV`. A KV adapter implements the
existing `FlagRepository`; no Cloudflare type crosses into application or
domain code.

Keys use `flags:{flagKey}`. Values use a strict, versioned JSON representation:

```json
{
  "version": 1,
  "key": "new-checkout",
  "enabled": true
}
```

The adapter rejects malformed values, unknown versions, unexpected fields, and
an embedded key that does not match the KV key. These failures reach clients as
a generic `500 INTERNAL_ERROR` rather than being interpreted as a missing or
disabled flag.

## Alternatives considered

### Keep the in-memory repository

This keeps local behavior simple but cannot provide persistence or shared state
and would not exercise the consistency model selected for the project.

### Store only the boolean value

This is smaller but has no explicit schema version, making later representation
changes ambiguous and unsafe to migrate.

### Use a strongly consistent Cloudflare storage service

Durable Objects or another store could provide stronger coordination, but that
would avoid the deliberate KV consistency learning objective and introduce
capabilities not required by the current boolean flag model.

## Consequences

### Positive

- The core remains independent of Cloudflare storage APIs.
- Persisted data has an explicit compatibility boundary.
- Local integration tests exercise the real Workers KV binding.

### Negative

- Reads after writes and deletes may be stale in deployed locations.
- The `PUT` distinction between `201` and `200` depends on a non-atomic read and
  can reflect stale information.
- Unknown versions fail closed until a migration or compatible reader exists.

## Validation / experiments

- [x] Exercise save, read, replace, and delete through local Workers KV.
- [x] Verify corrupt and unsupported values produce a generic internal error.
- [x] Validate a remotely provisioned namespace in Phase 4.
- [ ] Measure cross-location propagation and stale reads in Phase 15.

## Follow-up

- Provision and bind remote namespaces through Terraform in Phase 4.
- Define compatibility and migration rules before adding richer flag values.
- Measure KV propagation before claiming suitability for time-sensitive flags.
