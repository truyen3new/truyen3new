interface Env {
  ASSETS_SIGN_SECRET: string;
  ASSETS_BUCKET: R2Bucket;
}

function parseJwt(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
}

async function computeHmac(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload));
  const arr = Array.from(new Uint8Array(sig));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.replace(/^\//, '');

    if (!key) return new Response('Missing object key', { status: 400 });

    const sigParam = url.searchParams.get('sig');
    const secret = env.ASSETS_SIGN_SECRET;

    if (sigParam && secret) {
      const parts = sigParam.split('.');
      if (parts.length !== 2) return new Response('Unauthorized', { status: 401 });
      const [sig, expiry] = parts;
      const expiryTs = Number(expiry);
      if (!expiryTs || expiryTs < Date.now()) return new Response('Unauthorized', { status: 401 });

      const expected = await computeHmac(`${key}:${expiry}`, secret);
      if (!constantTimeEqual(expected, sig)) return new Response('Forbidden', { status: 403 });
    } else {
      const auth = request.headers.get('authorization') || '';
      if (auth.startsWith('Bearer ')) {
        try {
          const token = auth.slice(7);
          const payload = parseJwt(token);
          if (payload.role !== 'premium' && payload.role !== 'admin') {
            if (key.startsWith('vip/')) return new Response('Forbidden', { status: 403 });
          }
        } catch (e) {
          return new Response('Invalid token', { status: 401 });
        }
      } else {
        if (key.startsWith('vip/')) return new Response('Unauthorized', { status: 401 });
      }
    }

    try {
      const object = await env.ASSETS_BUCKET.get(key);
      if (!object) return new Response('Not Found', { status: 404 });

      const headers = new Headers();
      headers.set('cache-control', key.startsWith('vip/') ? 'private, max-age=60' : 'public, max-age=86400');
      if (object.httpMetadata?.contentType) headers.set('content-type', object.httpMetadata.contentType);

      return new Response(object.body, { status: 200, headers });
    } catch (err) {
      return new Response('Error fetching object', { status: 500 });
    }
  }
};
