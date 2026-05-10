import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuthorization, resolveAdminRequester } from '../_auth';
import { getServerSupabaseForRequest, hasServerSupabaseServiceRoleKey } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuthorization(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') || '200');
  try {
    const supabase = getServerSupabaseForRequest(request);
    if (!supabase) return NextResponse.json({ data: [] });
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('id,actor_user_id,action,target_user_id,target_email,metadata,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    const message = err?.message || 'internal';
    if (/row-level security policy/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'forbidden: RLS blocked this write. Sign in as an admin so a bearer token is forwarded, or configure SUPABASE_SERVICE_ROLE_KEY for internal-secret writes.',
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, metadata, target_user_id, target_email } = body as any;
    const supRequester = await resolveAdminRequester(request);

    // Dashboard access logging is best-effort and should not fail the request with auth noise.
    if (!supRequester.ok && action === 'dashboard_access') {
      return NextResponse.json({ ok: false, skipped: 'unauthorized-dashboard-access' });
    }

    if (!supRequester.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    if (supRequester.role === 'internal' && !hasServerSupabaseServiceRoleKey()) {
      return NextResponse.json(
        {
          error:
            'internal-secret writes require SUPABASE_SERVICE_ROLE_KEY (sb_service_role_*). Current configuration only has publishable/anon key.',
        },
        { status: 503 },
      );
    }

    const supabase = getServerSupabaseForRequest(request);
    if (!supabase) return NextResponse.json({ error: 'server-supabase-missing' }, { status: 503 });
    const { error } = await supabase.from('admin_audit_logs').insert({
      actor_user_id: supRequester.id,
      action,
      metadata,
      target_user_id,
      target_email,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'internal' }, { status: 500 });
  }
}
