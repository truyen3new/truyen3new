interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  R2_BUCKET: R2Bucket;
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

async function sbDelete(table: string, q: string, env: Env, token?: string | null): Promise<Response> {
  return sb(`/rest/v1/${table}?${q}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } }, env, token);
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

async function sbGetCount(q: string, env: Env, token?: string | null): Promise<number> {
  const h = new Headers();
  h.set('apikey', env.SUPABASE_ANON_KEY);
  h.set('Authorization', token ? `Bearer ${token}` : `Bearer ${env.SUPABASE_ANON_KEY}`);
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${q}`, {
    method: 'HEAD',
    headers: { ...Object.fromEntries(h.entries()), Prefer: 'count=exact' },
  });
  if (!res.ok) return 0;
  const range = res.headers.get('content-range');
  if (range) {
    const match = range.match(/\/(\d+)$/);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const token = authToken(request);

    try {
      if (method === 'POST' && path === '/admin/manage-story') {
        const body = await request.json() as any;
        const { action } = body;

        if (action === 'create' || (!action && body.story)) {
          const s = body.story || body;
          const payload: Record<string, unknown> = {
            title: s.title,
            author: s.author,
            description: s.description || null,
            cover_url: s.cover_url || null,
            status: s.status || 'draft',
            category: s.category || null,
            category_id: s.category_id || null,
            author_id: s.author_id || null,
          };
          const res = await sbPost('stories', payload, env, token);
          return handleRes(res);
        }

        if (action === 'update') {
          const res = await sbPatch('stories', `id=eq.${body.id}`, body.payload, env, token);
          return handleRes(res);
        }

        if (action === 'delete') {
          const res = await sbDelete('stories', `id=eq.${body.id}`, env, token);
          return res.ok ? json({ success: true }) : handleRes(res);
        }

        if (action === 'bulkUpdateStatus') {
          const { ids, status: newStatus } = body;
          const queries = ids.map((id: string) => `id=eq.${id}`).join(',');
          const res = await sbPatch('stories', `or=(${queries})`, { status: newStatus }, env, token);
          return res.ok ? json({ success: true }) : handleRes(res);
        }

        if (action === 'bulkDelete') {
          const queries = body.ids.map((id: string) => `id=eq.${id}`).join(',');
          const res = await sbDelete('stories', `or=(${queries})`, env, token);
          return res.ok ? json({ success: true }) : handleRes(res);
        }

        return err('BAD_REQUEST', 'Unknown manage-story action', 400);
      }

      if (method === 'POST' && path === '/admin/manage-chapter') {
        const body = await request.json() as any;
        const { action } = body;

        if (action === 'create' || (!action && body.chapter)) {
          const c = body.chapter || body;
          const payload = {
            story_id: c.story_id,
            chapter_number: c.chapter_number,
            title: c.title,
            content: c.content || '',
          };
          const res = await sbPost('chapters', payload, env, token);
          return handleRes(res);
        }

        if (action === 'update') {
          const res = await sbPatch('chapters', `id=eq.${body.id}`, body.payload, env, token);
          return handleRes(res);
        }

        if (action === 'delete') {
          const res = await sbDelete('chapters', `id=eq.${body.id}`, env, token);
          return res.ok ? json({ success: true }) : handleRes(res);
        }

        return err('BAD_REQUEST', 'Unknown manage-chapter action', 400);
      }

      if (method === 'POST' && path === '/admin/comics') {
        const body = await request.json() as any;
        const payload: Record<string, unknown> = {
          title: body.title,
          author: body.author,
          description: body.description || null,
          cover_url: body.cover_url || null,
          status: body.status || 'draft',
        };
        if (body.category) payload.category = Array.isArray(body.category) ? body.category.join(', ') : body.category;
        else if (body.genres) payload.category = Array.isArray(body.genres) ? body.genres.join(', ') : body.genres;
        if (body.tags) payload.tags = Array.isArray(body.tags) ? body.tags.join(', ') : body.tags;
        const res = await sbPost('stories', payload, env, token);
        return handleRes(res);
      }

      if (method === 'POST' && path.match(/^\/admin\/comics\/[^\/]+\/chapters$/)) {
        const comicId = path.split('/')[3];
        const body = await request.json() as any;
        const payload = {
          story_id: body.comicId || comicId,
          chapter_number: body.chapterNumber || body.chapter_number || 1,
          title: body.title,
          content: body.content || (body.pageUrls ? JSON.stringify(body.pageUrls) : ''),
        };
        const res = await sbPost('chapters', payload, env, token);
        return handleRes(res);
      }

      if (method === 'PATCH' && path.match(/^\/admin\/comics\/[^\/]+$/)) {
        const id = path.split('/')[3];
        const body = await request.json() as any;
        const payload: Record<string, unknown> = {};
        if (body.title !== undefined) payload.title = body.title;
        if (body.author !== undefined) payload.author = body.author;
        if (body.description !== undefined) payload.description = body.description;
        if (body.cover_url !== undefined) payload.cover_url = body.cover_url;
        else if (body.coverUrl !== undefined) payload.cover_url = body.coverUrl;
        if (body.status !== undefined) payload.status = body.status;
        if (body.category !== undefined) payload.category = body.category;
        else if (body.genres !== undefined) payload.category = Array.isArray(body.genres) ? body.genres.join(', ') : body.genres;
        if (body.tags !== undefined) payload.tags = Array.isArray(body.tags) ? body.tags.join(', ') : body.tags;
        const res = await sbPatch('stories', `id=eq.${id}`, payload, env, token);
        return handleRes(res);
      }

      if (method === 'DELETE' && path.match(/^\/admin\/comics\/[^\/]+$/)) {
        const id = path.split('/')[3];
        const res = await sbDelete('stories', `id=eq.${id}`, env, token);
        return res.ok ? json({ success: true }) : handleRes(res);
      }

      if (method === 'POST' && path === '/admin/comics/purge-cache') {
        return json({ status: 'error', error: { code: 'NOT_IMPLEMENTED', message: 'CF cache purge requires zone ID and API token config' } }, 501);
      }

      if (method === 'POST' && path === '/admin/audit') {
        const body = await request.json() as any;
        const userId = request.headers.get('x-user-id');
        const payload = {
          user_id: userId || null,
          action: body.action,
          entity_type: body.entity_type || 'comic',
          entity_id: body.entity_id || body.comicId || null,
          metadata: body.metadata || {},
        };
        const res = await sbPost('audit_logs', payload, env, token);
        return res.ok ? json({ success: true }) : handleRes(res);
      }

      if (method === 'GET' && path === '/admin/audit') {
        const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '200')));
        const q = `select=id,user_id,action,entity_type,entity_id,metadata,created_at&order=created_at.desc&limit=${limit}`;
        const res = await sbGet('audit_logs', q, env, token);
        return handleRes(res);
      }

      if (method === 'GET' && path === '/admin/site-settings') {
        const keys = url.searchParams.get('keys');
        const scope = url.searchParams.get('scope');
        let q = 'select=key,value';
        if (keys) {
          const keyList = keys.split(',').map(k => `key=eq.${k.trim()}`).join(',');
          q += `&or=(${keyList})`;
        }
        if (scope === 'admin') {
          q += '&key=like.admin_*';
        } else if (scope === 'public') {
          q += '&key=like.public_*';
        }
        const res = await sbGet('site_settings', q, env, token);
        return handleRes(res);
      }

      if (method === 'POST' && path === '/admin/site-settings') {
        const body = await request.json() as any;
        const userId = request.headers.get('x-user-id');
        if (body.payload && Array.isArray(body.payload)) {
          const results = [];
          for (const item of body.payload) {
            const upsertRes = await sbPost('site_settings',
              { key: item.key, value: item.value, updated_by: userId || null },
              env, token,
            );
            results.push(await upsertRes.json().catch(() => ({})));
          }
          return json({ success: true, results });
        }
        const res = await sbPost('site_settings',
          { key: body.key, value: body.value, updated_by: userId || null },
          env, token,
        );
        return handleRes(res);
      }

      if (method === 'GET' && path === '/admin/taxonomy') {
        const entity = url.searchParams.get('entity');
        if (entity === 'category') {
          const res = await sbGet('categories', 'select=id,name,description,created_at,updated_at&order=name.asc', env, token);
          return handleRes(res);
        }
        if (entity === 'author') {
          const res = await sbGet('authors', 'select=id,name,bio,created_at,updated_at&order=name.asc', env, token);
          return handleRes(res);
        }
        return err('BAD_REQUEST', 'Unknown taxonomy entity', 400);
      }

      if (method === 'GET' && path === '/admin/stories/field-values') {
        const field = url.searchParams.get('field');
        if (field !== 'category' && field !== 'author_id') {
          return err('BAD_REQUEST', 'Unknown field', 400);
        }
        const res = await sbGet('stories', `select=${field}&limit=1000`, env, token);
        return handleRes(res);
      }

      if (method === 'POST' && path === '/admin/taxonomy') {
        const body = await request.json() as any;
        const { entity, action: taxAction, id: taxId, payload: taxPayload } = body;

        if (entity === 'category') {
          if (taxAction === 'create') {
            const res = await sbPost('categories', taxPayload, env, token);
            return handleRes(res);
          }
          if (taxAction === 'update') {
            const res = await sbPatch('categories', `id=eq.${taxId}`, taxPayload, env, token);
            return handleRes(res);
          }
          if (taxAction === 'delete') {
            const res = await sbDelete('categories', `id=eq.${taxId}`, env, token);
            return res.ok ? json({ success: true }) : handleRes(res);
          }
        }

        if (entity === 'author') {
          if (taxAction === 'create') {
            const res = await sbPost('authors', taxPayload, env, token);
            return handleRes(res);
          }
          if (taxAction === 'update') {
            const res = await sbPatch('authors', `id=eq.${taxId}`, taxPayload, env, token);
            return handleRes(res);
          }
          if (taxAction === 'delete') {
            const res = await sbDelete('authors', `id=eq.${taxId}`, env, token);
            return res.ok ? json({ success: true }) : handleRes(res);
          }
        }

        return err('BAD_REQUEST', `Unknown taxonomy entity or action: ${entity}/${taxAction}`, 400);
      }

      if (method === 'GET' && path === '/admin/role-distribution') {
        const res = await sbGet('profiles', 'select=role&limit=10000', env, token);
        const profiles = await res.json() as Array<{ role: string }>;
        if (!Array.isArray(profiles)) return json({ data: [] });
        const distribution: Record<string, number> = {};
        for (const p of profiles) {
          distribution[p.role] = (distribution[p.role] || 0) + 1;
        }
        const data = Object.entries(distribution).map(([role, total]) => ({ role, total }));
        return json(data);
      }

      if (method === 'GET' && path === '/admin/site-metrics') {
        const type = url.searchParams.get('type');
        if (type === 'profiles') {
          const count = await sbGetCount('profiles?select=id', env, token);
          return json({ count });
        }
        if (type === 'chapters') {
          const count = await sbGetCount('chapters?select=id', env, token);
          return json({ count });
        }
        if (type === 'site-settings') {
          const count = await sbGetCount('site_settings?select=id', env, token);
          return json({ count });
        }
        return err('BAD_REQUEST', 'Unknown metric type', 400);
      }

      if (method === 'GET' && path === '/admin/analytics/dashboard') {
        const range = url.searchParams.get('range') || '7d';
        const storiesRes = await sbGet('stories', 'select=id,title,author,views,like_count,status,created_at&limit=5&order=created_at.desc', env, token);
        const stories = storiesRes.ok ? await storiesRes.json() : [];
        const viewsRes = await sbGet('stories', 'select=views&limit=10000', env, token);
        const views = viewsRes.ok ? await viewsRes.json() : [];
        const totalViews = Array.isArray(views)
          ? views.reduce((sum: number, row: { views?: number }) => sum + (Number(row.views) || 0), 0)
          : 0;
        const totalStories = await sbGetCount('stories?select=id', env, token);
        const totalChapters = await sbGetCount('chapters?select=id', env, token);
        const activeStories = await sbGetCount('stories?select=id&status=neq.draft&status=neq.archived', env, token);
        return json({
          stories,
          stats: { totalStories, totalChapters, activeStories, totalViews },
          range,
        });
      }

      if (method === 'POST' && path === '/admin/profiles') {
        const body = await request.json() as any;
        const { action, id } = body;

        if (action === 'updateRole') {
          const res = await sbPatch('profiles', `id=eq.${id}`, { role: body.role }, env, token);
          return res.ok ? json({ success: true }) : handleRes(res);
        }

        if (action === 'updateName') {
          const res = await sbPatch('profiles', `id=eq.${id}`, { full_name: body.full_name }, env, token);
          return res.ok ? json({ success: true }) : handleRes(res);
        }

        return err('BAD_REQUEST', 'Unknown profile action', 400);
      }

      if (method === 'POST' && path === '/admin/manage-user') {
        const body = await request.json() as any;
        const { action } = body;
        const svcKey = env.SUPABASE_SERVICE_KEY;

        if (!svcKey) {
          return err('NOT_CONFIGURED', 'SUPABASE_SERVICE_KEY not set', 500);
        }

        if (action === 'create') {
          const adminRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: svcKey,
              Authorization: `Bearer ${svcKey}`,
            },
            body: JSON.stringify({
              email: body.email,
              password: body.password,
              email_confirm: true,
              user_metadata: { full_name: body.full_name || '', role: body.role || 'user' },
            }),
          });
          const adminData = await adminRes.json();
          if (!adminRes.ok) return err('ADMIN_ERROR', adminData.msg || adminData.error || 'Create user failed', adminRes.status);
          return json({ data: adminData });
        }

        if (action === 'delete') {
          const adminRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${body.id}`, {
            method: 'DELETE',
            headers: {
              apikey: svcKey,
              Authorization: `Bearer ${svcKey}`,
            },
          });
          if (!adminRes.ok) {
            const adminData = await adminRes.json().catch(() => ({}));
            return err('ADMIN_ERROR', adminData.msg || adminData.error || 'Delete user failed', adminRes.status);
          }
          return json({ success: true });
        }

        return err('BAD_REQUEST', 'Unknown manage-user action', 400);
      }

      if (method === 'GET' && path === '/admin/profiles') {
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50')));
        const offset = (page - 1) * pageSize;
        const q = `select=id,email,role,full_name,created_at&order=created_at.desc&limit=${pageSize}&offset=${offset}`;
        const res = await sbGet('profiles', q, env, token);
        return handleRes(res);
      }

      if (method === 'GET' && path === '/admin/profiles/by-ids') {
        const ids = (url.searchParams.get('ids') || '')
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0);
        if (ids.length === 0) return json({ data: [] });
        const q = `select=id,email,full_name&order=created_at.desc&limit=500&id=in.(${ids.map(encodeURIComponent).join(',')})`;
        const res = await sbGet('profiles', q, env, token);
        return handleRes(res);
      }

      if (method === 'DELETE' && path.match(/^\/admin\/profiles\/[^\/]+$/)) {
        const id = path.split('/')[3];
        const res = await sbDelete('profiles', `id=eq.${id}`, env, token);
        return res.ok ? json({ success: true }) : handleRes(res);
      }

      if (method === 'GET' && path === '/admin/r2') {
        const userId = request.headers.get('x-user-id');
        if (!userId) return err('UNAUTHORIZED', 'Authentication required', 401);
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) return err('BAD_REQUEST', 'Missing url parameter', 400);
        try {
          const parsed = new URL(targetUrl);
          const allowed = parsed.hostname.endsWith('.r2.dev') || parsed.hostname.includes('.r2.cloudflarestorage.com');
          if (!allowed) {
            return err('FORBIDDEN', 'URL host not allowed', 403);
          }
          const upstreamRes = await fetch(targetUrl);
          const headers = new Headers(upstreamRes.headers);
          headers.set('cache-control', 'public, max-age=86400');
          headers.set('access-control-allow-origin', '*');
          return new Response(upstreamRes.body, { status: upstreamRes.status, headers });
        } catch {
          return err('PROXY_ERROR', 'Failed to fetch upstream', 502);
        }
      }

      if (method === 'POST' && path === '/admin/upload-to-r2') {
        const userId = request.headers.get('x-user-id');
        if (!userId) return err('UNAUTHORIZED', 'Authentication required', 401);
        const userRole = request.headers.get('x-user-role') || '';
        if (!['superadmin', 'admin', 'employee'].includes(userRole)) {
          return err('FORBIDDEN', 'Insufficient permissions', 403);
        }
        const bucketPrefix = request.headers.get('x-r2-bucket') || '';
        const formData = await request.formData();
        const fileEntries = formData.getAll('file').filter((f): f is File => f instanceof File);
        if (fileEntries.length === 0) return err('BAD_REQUEST', 'No files provided', 400);

        const urls: string[] = [];
        for (const file of fileEntries) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const key = bucketPrefix ? `${bucketPrefix}/${safeName}` : safeName;
          await env.R2_BUCKET.put(key, file.stream(), {
            httpMetadata: { contentType: file.type || 'application/octet-stream' },
          });
          const publicUrl = `https://${url.hostname}/api/admin/r2/${key}`;
          urls.push(publicUrl);
        }

        return json({ urls });
      }

      if (method === 'GET' && path.startsWith('/admin/r2/')) {
        const userId = request.headers.get('x-user-id');
        if (!userId) return err('UNAUTHORIZED', 'Authentication required', 401);
        const key = path.replace(/^\/admin\/r2\//, '');
        if (!key) return err('BAD_REQUEST', 'Missing object key', 400);
        try {
          const object = await env.R2_BUCKET.get(key);
          if (!object) return err('NOT_FOUND', 'Object not found', 404);
          const headers = new Headers();
          headers.set('cache-control', 'public, max-age=86400');
          headers.set('access-control-allow-origin', '*');
          if (object.httpMetadata?.contentType) headers.set('content-type', object.httpMetadata.contentType);
          return new Response(object.body, { status: 200, headers });
        } catch {
          return err('INTERNAL_ERROR', 'Failed to fetch object from R2', 500);
        }
      }

      return err('NOT_FOUND', `No route: ${method} ${path}`, 404);
    } catch (e: any) {
      return err('INTERNAL_ERROR', e.message || 'Unknown error', 500);
    }
  },
};
