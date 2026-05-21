import { afterEach, describe, it, expect } from 'vitest';
import worker from '../src/index';

function base64Url(source: string | Uint8Array) {
  let str: string;
  if (typeof source === 'string') str = Buffer.from(source).toString('base64');
  else str = Buffer.from(source).toString('base64');
  return str.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  (globalThis as any).SUPABASE_JWKS_URL = undefined;
  (globalThis as any).COMICS_WORKER = undefined;
});

describe('Gateway integration (simulated)', () => {
  it('forwards request to COMICS_WORKER and injects headers', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    );

    const pubJwk: any = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const header = { alg: 'RS256', typ: 'JWT', kid: 'integration-key' };
    const payload = { sub: 'user-123', email: 'int@example.com', exp: Math.floor(Date.now() / 1000) + 60 };
    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      keyPair.privateKey,
      new TextEncoder().encode(signingInput),
    );
    const token = `${signingInput}.${base64Url(new Uint8Array(signature))}`;

    // Stub COMICS_WORKER with a fetch function that captures the forwarded request
    let capturedRequest: Request | null = null;
    (globalThis as any).COMICS_WORKER = {
      fetch: async (req: Request) => {
        capturedRequest = req;
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    };

    (globalThis as any).SUPABASE_JWKS_URL = 'https://example.test/.well-known/jwks.json';
    (globalThis as any).fetch = async (_url: string) => ({
      ok: true,
      json: async () => ({
        keys: [{ kty: 'RSA', n: pubJwk.n, e: pubJwk.e, alg: 'RS256', kid: 'integration-key' }],
      }),
    });

    const req = new Request('https://gateway.test/api/v1/comics/123/chapters', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    const res = await worker.fetch(req, {
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_JWKS_URL: 'https://example.test/.well-known/jwks.json',
      COMICS_WORKER: (globalThis as any).COMICS_WORKER,
      STORIES_WORKER: (globalThis as any).COMICS_WORKER,
      ADMIN_WORKER: (globalThis as any).COMICS_WORKER,
      ANALYTICS_WORKER: (globalThis as any).COMICS_WORKER,
    } as any, {} as ExecutionContext);

    expect(res.status).toBe(200);
    expect(capturedRequest).not.toBeNull();
    if (capturedRequest) {
      expect(capturedRequest.headers.get('x-user-id')).toBe('user-123');
      expect(capturedRequest.headers.get('x-forwarded-by')).toBe('api-gateway');
    }
  });

  it('rejects bearer tokens when JWKS is not configured', async () => {
    (globalThis as any).SUPABASE_JWKS_URL = undefined;

    const req = new Request('https://gateway.test/api/v1/comics/123/chapters', {
      method: 'GET',
      headers: { Authorization: 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6OTk5OTk5OTk5OX0.sig' },
    });

    const res = await worker.fetch(req, {
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_ANON_KEY: 'anon-key',
      COMICS_WORKER: (globalThis as any).COMICS_WORKER,
      STORIES_WORKER: (globalThis as any).COMICS_WORKER,
      ADMIN_WORKER: (globalThis as any).COMICS_WORKER,
      ANALYTICS_WORKER: (globalThis as any).COMICS_WORKER,
    } as any, {} as ExecutionContext);
    expect(res.status).toBe(401);
  });
});
