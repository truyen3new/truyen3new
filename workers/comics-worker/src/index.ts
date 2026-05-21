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

async function sbPatch(table: string, q: string, body: unknown, env: Env, token?: string | null): Promise<Response> {
  return sb(`/rest/v1/${table}?${q}`, { method: 'PATCH', body: JSON.stringify(body), headers: { Prefer: 'return=representation' } }, env, token);
}

async function sbRpc(name: string, body: unknown, env: Env, token?: string | null): Promise<Response> {
  return sb(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(body) }, env, token);
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
      if (method === 'GET' && path === '/comics') {
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '10')));
        const keyword = url.searchParams.get('keyword') || '';
        const offset = (page - 1) * pageSize;
        const conditions: string[] = ['status=neq.archived'];
        if (keyword) conditions.push(`or=(title.ilike.*${keyword}*,author.ilike.*${keyword}*)`);
        const q = `select=id,title,author,description,cover_url,category,status,views,like_count,created_at,updated_at&order=created_at.desc&limit=${pageSize}&offset=${offset}`;
        const res = await sbGet('stories', q, env, token);
        return handleRes(res);
      }

      if (method === 'GET' && path.match(/^\/comics\/[^\/]+$/)) {
        const id = path.split('/')[2];
        const res = await sbGet('stories', `id=eq.${id}&select=*`, env, token);
        const data = await res.json();
        if (!res.ok) return handleRes(res);
        return json(Array.isArray(data) ? data[0] || null : data);
      }

      if (method === 'POST' && path === '/comics') {
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

      if (method === 'GET' && path.match(/^\/comics\/[^\/]+\/chapters$/)) {
        const comicId = path.split('/')[2];
        const res = await sbGet('chapters', `story_id=eq.${comicId}&select=id,story_id,chapter_number,title,content,view_count,created_at,updated_at&order=chapter_number.asc`, env, token);
        return handleRes(res);
      }

      if (method === 'POST' && path.match(/^\/comics\/[^\/]+\/chapters$/)) {
        const comicId = path.split('/')[2];
        const body = await request.json() as any;
        const payload = {
          story_id: body.storyId || comicId,
          chapter_number: body.chapterNumber || body.chapter_number || 1,
          title: body.title,
          content: body.content || '',
        };
        const res = await sbPost('chapters', payload, env, token);
        return handleRes(res);
      }

      return err('NOT_FOUND', `No route: ${method} ${path}`, 404);
    } catch (e: any) {
      return err('INTERNAL_ERROR', e.message || 'Unknown error', 500);
    }
  },
};
