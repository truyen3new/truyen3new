import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuthorization } from '../_auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuthorization(req);
  if (!auth.ok) return auth.response;

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'server supabase unavailable' }, { status: 503 });

  const body = await req.json();
  const { chapter, action, id } = body;

  try {
    if (action === 'update') {
      const { data, error } = await supabase.from('chapters').update(chapter).eq('id', id).select('*');
      if (error) throw error;
      const updatedChapter = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ chapter: updatedChapter });
    }

    if (action === 'delete') {
      const { error } = await supabase.from('chapters').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // default create
    if (chapter) {
      const { data, error } = await supabase.from('chapters').insert([chapter]).select('*');
      if (error) throw error;
      const newChapter = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ chapter: newChapter });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
