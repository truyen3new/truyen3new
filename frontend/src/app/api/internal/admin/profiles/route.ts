import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuthorization } from '../_auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuthorization(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const ids = url.searchParams.get('ids');
  try {
    const supabase = getServerSupabase();
    if (!supabase) return NextResponse.json({ data: [] });
    if (ids) {
      const idList = ids.split(',').map((s) => s.trim()).filter(Boolean);
      const { data, error } = await supabase.from('profiles').select('id,email,full_name').in('id', idList);
      if (error) throw error;
      return NextResponse.json({ data });
    }

    const { data, error } = await supabase.from('profiles').select('id,email,role,full_name').order('role', { ascending: true }).limit(500);
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'internal' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuthorization(request);
  if (!auth.ok) return auth.response;
  const supRequester = auth.requester;

  try {
    const body = await request.json();
    const { action, id, role, full_name } = body as any;
    if (!id || !action) return NextResponse.json({ error: 'invalid' }, { status: 400 });

    const supabase = getServerSupabase();
    if (!supabase) return NextResponse.json({ error: 'server-supabase-missing' }, { status: 503 });

    if (action === 'updateRole') {
      // Only superadmin can change roles
      if (supRequester.role !== 'superadmin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'updateName') {
      const { error } = await supabase.from('profiles').update({ full_name }).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'internal' }, { status: 500 });
  }
}
