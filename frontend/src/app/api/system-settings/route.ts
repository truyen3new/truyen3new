import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireRouteAuthorization } from '@/lib/routeAuth';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const keys = url.searchParams.get('keys')?.split(',') || [];

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'server supabase unavailable' }, { status: 503 });

  try {
    let query = supabase.from('site_settings').select('key,value');
    if (keys.length > 0) {
      query = query.in('key', keys);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'server supabase unavailable' }, { status: 500 });

  const auth = await requireRouteAuthorization(req, { 
    allowedRoles: ['admin', 'superadmin', 'internal'],
    unauthorizedMessage: 'Authentication required. Ensure Authorization header with valid token or x-internal-secret is provided.',
  });
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const payload = body.payload || [];

  try {
    const { error } = await supabase.from('site_settings').upsert(payload, { onConflict: 'key' });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
