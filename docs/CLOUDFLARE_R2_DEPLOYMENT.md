# Cloudflare R2 Deployment Guide (images, protected assets, Workers)

This guide explains recommended steps to deploy comic assets to Cloudflare R2 and securely serve them via Workers.

## Create R2 bucket

- In the Cloudflare dashboard, go to R2 → Create bucket. Use a descriptive name like `lightstory-assets`.

## Upload strategy

- Upload raw story images and derived sizes (webp, small/medium/large). Use a deterministic object key: `stories/{story_id}/{chapter}/{image_name}@{width}.webp`.
- Keep originals in a separate `originals/` prefix for re-derivation.

## Worker for signed URLs (protect VIP images)

- Deploy a Cloudflare Worker that validates a short-lived token (JWT signed by your backend) and returns a signed URL or proxies the object.
- Signed-URL pattern: Worker checks `Authorization` header (Bearer JWT), validates the `role` claim, and fetches from R2 using the R2 binding.

Example Worker pseudocode:

```js
addEventListener('fetch', event => {
  const req = event.request;
  // 1) validate JWT
  // 2) check role/premium claims
  // 3) return fetch(`https://<account>.r2.cloudflarestorage.com/${bucket}/${key}`)
});
```

## Caching and CDN

- Set `Cache-Control` headers via Worker when proxying to ensure Cloudflare caches at edge.
- Use long TTLs for public assets; use short TTLs for VIP assets and rely on signed URLs.

## Cost & egress minimization

- Serve through Cloudflare's CDN (Workers + cache) to reduce repeated origin fetches.
- Use image optimization (Cloudflare Images or transform in Workers) to reduce payload size.

## Security

- Keep R2 credentials and account keys in a secure secrets store (Workers secrets or your backend). Do not expose keys to client-side code.
- Use short-lived JWTs from your backend to gate access to VIP assets.

## Deployment

- Use `wrangler` or the Cloudflare dashboard to deploy Workers and bind R2 buckets.
- Example `wrangler.toml` snippet:

```toml
[bindings]
type = "r2_bucket"
name = "ASSETS_BUCKET"
bucket_name = "lightstory-assets"
```
