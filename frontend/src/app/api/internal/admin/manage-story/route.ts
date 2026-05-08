import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSessionClient } from '@/lib/server';
import { getServerSupabase } from '@/lib/supabase/server';

async function getRequester() {
  try {
    const sessionClient = await createSessionClient();
    const { data: userData, error: userError } = await sessionClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return { ok: false };

    const supabase = getServerSupabase();
    if (supabase) {
      const { data } = await supabase.from('profiles').select('id,role').eq('id', userId).single();
      if (data?.role) return { ok: true, id: userId, role: data.role };
    }

    // Fall back to app_metadata.role or user_metadata.role
    const metadataRole = userData.user?.app_metadata?.role ?? userData.user?.user_metadata?.role;
    if (typeof metadataRole === 'string' && metadataRole.trim()) {
      return { ok: true, id: userId, role: metadataRole.trim() };
    }

    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest) {
  const requester = await getRequester();
  if (!requester.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'server supabase unavailable' }, { status: 503 });

  const body = await req.json();
  const { action, story, id, payload, ids, status } = body;

  try {
    if (action === 'update') {
      const { data, error } = await supabase.from('stories').update(payload).eq('id', id).select('*');
      if (error) throw error;
      const updatedStory = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ story: updatedStory });
    }

    if (action === 'delete') {
      const { error } = await supabase.from('stories').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'bulkUpdateStatus') {
      const { error } = await supabase.from('stories').update({ status }).in('id', ids);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'bulkDelete') {
      const { error } = await supabase.from('stories').delete().in('id', ids);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // default: create
    if (story) {
      const { data, error } = await supabase.from('stories').insert([story]).select('*');
      if (error) throw error;
      const newStory = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ story: newStory });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
