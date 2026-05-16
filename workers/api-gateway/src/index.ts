import { validateJWT, UnauthorizedError } from './auth';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_JWKS_URL?: string;
  COMICS_WORKER: Fetcher;
  STORIES_WORKER: Fetcher;
  ADMIN_WORKER: Fetcher;
  ANALYTICS_WORKER: Fetcher;
}

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://lightstory.app',
  'https://staging.lightstory.app',
];

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Expose-Headers': 'x-request-id, x-begin-timestamp',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function stripApiPrefix(pathname: string) {
  return pathname.replace(/^\/api\/?v?\d*\/?/i, '/');
}

function supabaseProxyPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/supabase\/(rest|auth|storage)(\/v\d+\/.*)$/i);
  if (match) return `/${match[1]}${match[2]}`;
  const rpcMatch = pathname.match(/^\/api\/rpc\/(.+)$/i);
  if (rpcMatch) return `/rest/v1/rpc/${rpcMatch[1]}`;
  return null;
}

async function handleSupabaseProxy(pathname: string, request: Request, origin: string | null, env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return new Response(
      JSON.stringify({ status: 'error', error: { code: 'SUPABASE_NOT_CONFIGURED' } }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } },
    );
  }

  const sbPath = supabaseProxyPath(pathname);
  if (!sbPath) {
    return new Response(
      JSON.stringify({ status: 'error', error: { code: 'INVALID_SUPABASE_PATH' } }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } },
    );
  }

  const targetUrl = `${env.SUPABASE_URL}${sbPath}`;
  const headers = new Headers(request.headers);
  headers.set('apikey', env.SUPABASE_ANON_KEY);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${env.SUPABASE_ANON_KEY}`);
  }
  headers.delete('x-forwarded-by');
  headers.delete('x-begin-timestamp');
  headers.delete('x-request-id');

  const upstreamReq = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.body ?? undefined,
    redirect: 'manual',
  });

  const res = await fetch(upstreamReq);
  const responseHeaders = new Headers(res.headers);
  const c = corsHeaders(origin);
  for (const [k, v] of Object.entries(c)) responseHeaders.set(k, v as string);

  return new Response(res.body, { status: res.status, headers: responseHeaders });
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    (globalThis as any).SUPABASE_URL = env.SUPABASE_URL;
    (globalThis as any).SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
    (globalThis as any).SUPABASE_JWKS_URL = env.SUPABASE_JWKS_URL;
    (globalThis as any).COMICS_WORKER = env.COMICS_WORKER;
    (globalThis as any).STORIES_WORKER = env.STORIES_WORKER;
    (globalThis as any).ADMIN_WORKER = env.ADMIN_WORKER;
    (globalThis as any).ANALYTICS_WORKER = env.ANALYTICS_WORKER;

    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    const pathname = url.pathname;
    if (pathname.startsWith('/api/supabase/') || pathname.startsWith('/api/rpc/')) {
      return handleSupabaseProxy(pathname, request, origin, env);
    }

    const authHeader = request.headers.get('Authorization') ?? '';
    let authCtx = null;
    try {
      if (authHeader) authCtx = await validateJWT(authHeader);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return new Response(JSON.stringify({ status: 'error', error: { code: 'UNAUTHORIZED', message: e.message } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
      return new Response(JSON.stringify({ status: 'error', error: { code: 'INTERNAL_ERROR' } }), { status: 500 });
    }

    let targetBinding: Fetcher | null = null;
    if (pathname.startsWith('/api/v1/stories') || pathname.startsWith('/api/stories')) {
      targetBinding = env.STORIES_WORKER;
    } else if (pathname.startsWith('/api/v1/chapters') || pathname.startsWith('/api/chapters')) {
      targetBinding = env.STORIES_WORKER;
    } else if (pathname.startsWith('/api/v1/comics') || pathname.startsWith('/api/comics')) {
      targetBinding = env.COMICS_WORKER;
    } else if (pathname.startsWith('/api/v1/admin') || pathname.startsWith('/api/admin')) {
      targetBinding = env.ADMIN_WORKER;
    } else if (pathname.startsWith('/api/v1/analytics') || pathname.startsWith('/api/analytics')) {
      targetBinding = env.ANALYTICS_WORKER;
    } else {
      return new Response(JSON.stringify({ status: 'error', error: { code: 'NOT_FOUND' } }), { status: 404 });
    }

    const downstreamUrl = new URL(request.url);
    downstreamUrl.pathname = stripApiPrefix(downstreamUrl.pathname);

    const headers = new Headers(request.headers);
    headers.set('x-request-id', crypto.randomUUID());
    headers.set('x-begin-timestamp', String(Date.now()));
    if (authCtx) {
      headers.set('x-user-id', authCtx.userId);
      headers.set('x-user-role', authCtx.role);
      if (authCtx.email) headers.set('x-user-email', authCtx.email);
    }
    headers.set('x-forwarded-by', 'api-gateway');

    const downstreamReq = new Request(downstreamUrl.toString(), {
      method: request.method,
      headers,
      body: request.body ?? undefined,
      redirect: 'manual',
    });

    const res = await targetBinding.fetch(downstreamReq);
    const responseHeaders = new Headers(res.headers);
    const c = corsHeaders(origin);
    for (const [k, v] of Object.entries(c)) responseHeaders.set(k, v as string);

    return new Response(res.body, { status: res.status, headers: responseHeaders });
  },
};
