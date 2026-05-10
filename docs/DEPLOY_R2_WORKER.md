# Deploying the R2 Proxy Worker

This document shows how to deploy the `lightstory-r2-proxy` Cloudflare Worker that proxies R2 assets and enforces simple JWT-based access control.


## Prerequisites

- `wrangler` CLI installed and logged in with a token that has `workers` and `r2` permissions.
- `CF_ACCOUNT_ID` and `WRANGLER_API_TOKEN` (or `wrangler login` interactive flow).
- R2 bucket created (e.g., `lightstory-assets`).

## Steps

### 1. Edit `workers/r2-signed-url/wrangler.toml`

- Replace `bucket_name = "lightstory-assets"` with your actual bucket name.
- If you use KV, set the `namespace_id` accordingly.

### 2 — Set environment variables for the deploy session

```bash
export CF_ACCOUNT_ID=your_account_id
export WRANGLER_API_TOKEN=your_token
```

### 3 — Publish the Worker

```bash
cd workers/r2-signed-url
wrangler publish
```

### 4 — Configure DNS / route (optional)

- Use `wrangler publish` `--routes` or set routes in the `wrangler.toml`.

## Security notes

- The Worker file contains only a placeholder JWT check (`parseJwt`) that does not verify signatures. Replace `parseJwt` with proper verification using JWKS or a shared secret before using in production.
- Keep `WRANGLER_API_TOKEN` and any secrets out of source. Use `wrangler secret put` to store runtime secrets.

## Runtime bindings

- The `wrangler.toml` expects an R2 binding named `ASSETS_BUCKET`. After publishing, the binding will be available in the Worker as `ASSETS_BUCKET`.
