addEventListener('fetch', event => {
  event.respondWith(handle(event.request, event));
});

/**
 * Worker that proxies R2 objects after validating a short-lived JWT.
 * Bindings required in wrangler.toml: r2 bucket binding named ASSETS_BUCKET
 */
async function handle(request, event) {
  const url = new URL(request.url);
  const key = url.pathname.replace(/^\//, '');

  if (!key) return new Response('Missing object key', { status: 400 });

  // Expect Authorization: Bearer <jwt>
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 });
  const token = auth.slice(7);

  // Minimal JWT verification placeholder — replace with production verification.
  // In production: verify signature with your auth provider's JWKS or shared secret.
  try {
    const payload = parseJwt(token);
    // Check role claim for VIP gating
    if (payload.role !== 'premium' && payload.role !== 'admin') {
      // allow public assets (non-vip) — check by path convention
      if (key.startsWith('vip/')) return new Response('Forbidden', { status: 403 });
    }
  } catch (e) {
    return new Response('Invalid token', { status: 401 });
  }

  // Fetch object from R2 binding
  try {
    const object = await ASSETS_BUCKET.get(key);
    if (!object) return new Response('Not Found', { status: 404 });

    // Stream response and set caching for public assets
    const headers = new Headers();
    headers.set('cache-control', key.startsWith('vip/') ? 'private, max-age=60' : 'public, max-age=86400');
    if (object.httpMetadata && object.httpMetadata.contentType) headers.set('content-type', object.httpMetadata.contentType);

    const body = object.body;
    return new Response(body, { status: 200, headers });
  } catch (err) {
    return new Response('Error fetching object', { status: 500 });
  }
}

function parseJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
}
