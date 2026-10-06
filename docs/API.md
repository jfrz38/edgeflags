# EdgeFlags API

This document describes the HTTP API implemented by the local EdgeFlags Worker.
The API is unauthenticated until the API security phase.

## Feature flags

A feature flag has a key and a boolean value:

```json
{
  "key": "new-checkout",
  "enabled": true
}
```

Keys contain 1 to 64 lowercase letters, numbers, or hyphens and start with a
letter or number.

### Create or replace a flag

```http
PUT /flags/:key
Content-Type: application/json

{"enabled":true}
```

The body must contain only the boolean `enabled` property. Creating a flag
returns `201 Created` and its canonical path in `Location`. Replacing an
existing flag returns `200 OK`. Repeating the same request is idempotent.

```bash
curl --fail-with-body \
  --request PUT \
  --header "Content-Type: application/json" \
  --data '{"enabled":true}' \
  http://localhost:8787/flags/new-checkout
```

### Read a flag

```http
GET /flags/:key
```

The response contains the stored definition. An absent flag returns `404 Not
Found` rather than being treated as disabled.

```bash
curl --fail-with-body http://localhost:8787/flags/new-checkout
```

### Delete a flag

```http
DELETE /flags/:key
```

Deletion returns `204 No Content`. Deleting an absent flag also returns `204`,
so clients can safely retry the operation.

```bash
curl --fail-with-body \
  --request DELETE \
  http://localhost:8787/flags/new-checkout
```

### Evaluate a flag

```http
GET /evaluate/:key
```

Evaluation returns the effective boolean value without exposing the storage
representation:

```json
{
  "key": "new-checkout",
  "value": true
}
```

An absent flag returns `404 Not Found`, which keeps absence distinct from a
stored `false` value.

```bash
curl --fail-with-body http://localhost:8787/evaluate/new-checkout
```

## Errors

Expected errors use a stable JSON envelope:

```json
{
  "error": {
    "code": "FLAG_NOT_FOUND",
    "message": "Flag 'new-checkout' was not found"
  }
}
```

| Status | Code | Condition |
| --- | --- | --- |
| `400` | `INVALID_FLAG_KEY` | The path contains an invalid flag key. |
| `400` | `INVALID_REQUEST` | The JSON is malformed or does not match the request schema. |
| `404` | `FLAG_NOT_FOUND` | A read or evaluation refers to an absent flag. |
| `404` | `ROUTE_NOT_FOUND` | The requested path is not part of the API. |
| `405` | `METHOD_NOT_ALLOWED` | A known path does not support the HTTP method. |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | A `PUT` request is not JSON. |

## Temporary storage

The current repository is an in-memory adapter. Data can disappear when the
local Worker restarts or a Cloudflare isolate is replaced, and different
isolates do not share state. This behavior is suitable only for local learning
and tests. Phase 3 replaces this adapter with Cloudflare KV while preserving the
application and HTTP behavior.
