interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function err(code: string, message: string, status: number): Response {
  return json({ status: 'error', error: { code, message } }, status);
}

function authToken(req: Request): string | null {
  const a = req.headers.get('Authorization');
  if (a?.startsWith('Bearer ')) return a.slice(7);
  return null;
}

async function sb(path: string, opts: RequestInit, env: Env, token?: string | null): Promise<Response> {
  const h = new Headers(opts.headers);
  h.set('apikey', env.SUPABASE_ANON_KEY);
  h.set('Content-Type', 'application/json');
  h.set('Authorization', token ? `Bearer ${token}` : `Bearer ${env.SUPABASE_ANON_KEY}`);
  return fetch(`${env.SUPABASE_URL}${path}`, { ...opts, headers: h });
}

async function sbGet(table: string, q: string, env: Env, token?: string | null): Promise<Response> {
  return sb(`/rest/v1/${table}?${q}`, { method: 'GET' }, env, token);
}

async function sbPost(table: string, body: unknown, env: Env, token?: string | null): Promise<Response> {
  return sb(`/rest/v1/${table}`, { method: 'POST', body: JSON.stringify(body), headers: { Prefer: 'return=representation' } }, env, token);
}

async function handleRes(res: Response): Promise<Response> {
  if (!res.ok) {
    const text = await res.text();
    return err('SUPABASE_ERROR', text, res.status);
  }
  const data = await res.json();
  return json(data);
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const token = authToken(request);

    try {
      if (method === 'GET' && path === '/stories') {
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '10')));
        const keyword = url.searchParams.get('keyword') || '';
        const offset = (page - 1) * pageSize;
        let q = `select=id,title,author,description,cover_url,category,status,views,like_count,created_at,updated_at&order=created_at.desc&limit=${pageSize}&offset=${offset}`;
        if (keyword) {
          q += `&or=(title.ilike.*${keyword}*,author.ilike.*${keyword}*)`;
        }
        const res = await sbGet('stories', q, env, token);
        return handleRes(res);
      }

      if (method === 'GET' && path.match(/^\/stories\/[^\/]+$/)) {
        const id = path.split('/')[2];
        const res = await sbGet('stories', `id=eq.${id}&select=*`, env, token);
        const data = await res.json();
        if (!res.ok) return err('SUPABASE_ERROR', await res.text(), res.status);
        return json(Array.isArray(data) ? data[0] || null : data);
      }

      if (method === 'POST' && path === '/stories') {
        const body = await request.json() as any;
        const payload: Record<string, unknown> = {
          title: body.title,
          author: body.author,
          description: body.description || null,
          cover_url: body.cover_url || null,
          status: body.status || 'draft',
        };
        if (body.category) payload.category = Array.isArray(body.category) ? body.category.join(', ') : body.category;
        const res = await sbPost('stories', payload, env, token);
        return handleRes(res);
      }

      if (method === 'GET' && path === '/chapters') {
        const id = url.searchParams.get('id');
        const storyId = url.searchParams.get('storyId');
        if (id) {
          const res = await sbGet('chapters', `id=eq.${id}&select=*`, env, token);
          const data = await res.json();
          if (!res.ok) return err('SUPABASE_ERROR', await res.text(), res.status);
          return json(Array.isArray(data) ? data[0] || null : data);
        }
        if (storyId) {
          const res = await sbGet('chapters', `story_id=eq.${storyId}&select=*&order=chapter_number.asc`, env, token);
          return handleRes(res);
        }
        return err('BAD_REQUEST', 'Missing id or storyId parameter', 400);
      }

      if (method === 'POST' && path === '/stories/views') {
        const body = await request.json() as any;
        const res = await sb('/rest/v1/rpc/increment_story_views', {
          method: 'POST',
          body: JSON.stringify({ story_id: body.storyId }),
        }, env, token);
        return handleRes(res);
      }

      return err('NOT_FOUND', `No route: ${method} ${path}`, 404);
    } catch (e: any) {
      return err('INTERNAL_ERROR', e.message || 'Unknown error', 500);
    }
  },
};
