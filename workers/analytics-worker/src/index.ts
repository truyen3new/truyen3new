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

async function sbRpc(name: string, body: unknown, env: Env, token?: string | null): Promise<Response> {
  return sb(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(body) }, env, token);
}

async function sbGet(table: string, q: string, env: Env, token?: string | null): Promise<Response> {
  return sb(`/rest/v1/${table}?${q}`, { method: 'GET' }, env, token);
}

async function handleRes(res: Response): Promise<Response> {
  if (!res.ok) {
    const text = await res.text();
    return err('SUPABASE_ERROR', text, res.status);
  }
  const text = await res.text();
  if (!text) return json({ success: true });
  return json(JSON.parse(text));
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const token = authToken(request);

    try {
      if (method === 'GET' && path === '/analytics/overview') {
        const totalRes = await sbGet('stories', 'select=id', env, token);
        const totalData = await totalRes.json();
        const totalStories = Array.isArray(totalData) ? totalData.length : 0;
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const recentChapters = await sbGet('chapters', `select=id&created_at=gte.${sevenDaysAgo}`, env, token);
        const chaptersData = recentChapters.ok ? await recentChapters.json() : [];
        const chaptersCount = Array.isArray(chaptersData) ? (chaptersData as any[]).length : 0;
        return json({ totalStories, recentChapters: chaptersCount, generatedAt: new Date().toISOString() });
      }

      if (method === 'GET' && path === '/analytics/engagement') {
        const daysBack = parseInt(url.searchParams.get('days') || '30');
        const res = await sbRpc('get_user_engagement_summary', { p_days_back: daysBack }, env, token);
        return handleRes(res);
      }

      if (method === 'GET' && path === '/analytics/top-stories') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const res = await sbGet('stories', `select=id,title,author,views,like_count&order=views.desc&limit=${limit}`, env, token);
        return handleRes(res);
      }

      if (method === 'GET' && path === '/analytics/infrastructure') {
        return json({
          r2_usage_gb: 0,
          r2_allocated_gb: 0,
          r2_object_count: 0,
          r2_egress_gb: 0,
          d1_queries_count: 0,
          d1_avg_latency_ms: 0,
          page_views: 0,
          bandwidth_gb: 0,
          cache_hit_ratio_pct: 0,
          storage_efficiency_pct: 0,
          device_mobile: 0,
          device_desktop: 0,
          device_tablet: 0,
          top_zones: [],
          recorded_at: new Date().toISOString(),
        });
      }

      if (method === 'POST' && path === '/analytics/record-view') {
        const body = await request.json() as any;
        const res = await sbRpc('increment_story_views', { story_id_param: body.storyId }, env, token);
        return handleRes(res);
      }

      return err('NOT_FOUND', `No route: ${method} ${path}`, 404);
    } catch (e: any) {
      return err('INTERNAL_ERROR', e.message || 'Unknown error', 500);
    }
  },
};
