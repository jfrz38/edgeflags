# EdgeFlags API

This document describes the HTTP API implemented by EdgeFlags. The root health
endpoint is public. Flag management and evaluation are protected by Cloudflare
Access when environment activation is enabled.

## Authentication and authorization

Cloudflare Access authenticates requests before protected Worker code runs.
Human operators sign in through an identity provider configured in Access.
Automated clients send an Access Service Token:

```http
CF-Access-Client-Id: <client-id>
CF-Access-Client-Secret: <client-secret>
```

Never log, commit, or place these values in Terraform inputs. Access credentials
prove identity; EdgeFlags separately requires an operation scope:

| Operation | Required scope |
| --- | --- |
| Read a flag definition | `flags:read` |
| Create, replace, or delete a flag | `flags:write` |
| Evaluate a flag | `flags:evaluate` |

An authenticated identity missing from the environment authorization policy or
lacking the required scope receives `403 Forbidden`. A protected route reached
without an Access identity fails closed with `401 Unauthorized`; remotely,
Cloudflare Access normally rejects such traffic before it reaches the Worker.
The root `GET /` health endpoint remains public.

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
  --header "CF-Access-Client-Id: $ACCESS_CLIENT_ID" \
  --header "CF-Access-Client-Secret: $ACCESS_CLIENT_SECRET" \
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
curl --fail-with-body \
  --header "CF-Access-Client-Id: $ACCESS_CLIENT_ID" \
  --header "CF-Access-Client-Secret: $ACCESS_CLIENT_SECRET" \
  http://localhost:8787/flags/new-checkout
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
  --header "CF-Access-Client-Id: $ACCESS_CLIENT_ID" \
  --header "CF-Access-Client-Secret: $ACCESS_CLIENT_SECRET" \
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
curl --fail-with-body \
  --header "CF-Access-Client-Id: $ACCESS_CLIENT_ID" \
  --header "CF-Access-Client-Secret: $ACCESS_CLIENT_SECRET" \
  http://localhost:8787/evaluate/new-checkout
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
| `401` | `UNAUTHENTICATED` | A protected route reached the Worker without an Access identity. |
| `403` | `FORBIDDEN` | The authenticated identity lacks the required scope. |
| `404` | `FLAG_NOT_FOUND` | A read or evaluation refers to an absent flag. |
| `404` | `ROUTE_NOT_FOUND` | The requested path is not part of the API. |
| `405` | `METHOD_NOT_ALLOWED` | A known path does not support the HTTP method. |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | A `PUT` request is not JSON. |
| `500` | `INTERNAL_ERROR` | Storage failed or persisted data could not be read safely. |

Unexpected failures use the same envelope without exposing provider details:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An internal error occurred"
  }
}
```

## Storage consistency

The Worker stores flags in Cloudflare KV. Local development and integration
tests use a local KV binding; remote namespaces are introduced with
infrastructure provisioning.

KV is eventually consistent when deployed. A successful write or delete may not
be visible immediately from every location. The `201` or `200` returned by
`PUT` depends on the value visible before the write, so it does not provide an
atomic global create-or-replace distinction. Clients may retry `PUT` and
`DELETE`, but must not use the status distinction as a concurrency guarantee.
