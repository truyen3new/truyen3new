import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/server';
import { getServerSupabase } from '@/lib/supabase/server';

type Requester = { ok: boolean; role?: string };

function resolveRequesterRole(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function getRequester(request: NextRequest): Promise<Requester> {
  const internalSecret = request.headers.get('x-internal-secret');
  if (internalSecret && process.env.INTERNAL_ADMIN_SECRET && internalSecret === process.env.INTERNAL_ADMIN_SECRET) {
    return { ok: true, role: 'internal' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authClient = supabaseUrl && supabaseKey ? createSupabaseClient(supabaseUrl, supabaseKey) : null;

  try {
    const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length).trim();
      if (token && authClient) {
        const { data: userData, error: userError } = await authClient.auth.getUser(token);
        const userId = userData.user?.id;
        if (userError || !userId) return { ok: false };

        const supabase = getServerSupabase();
        if (supabase) {
          const { data } = await supabase.from('profiles').select('id,role').eq('id', userId).single();
          if (data?.role) return { ok: true, role: data.role };
        }

        const metadataRole =
          resolveRequesterRole(userData.user?.app_metadata?.role) ??
          resolveRequesterRole(userData.user?.user_metadata?.role);
        if (metadataRole) return { ok: true, role: metadataRole };
      }
    }

    const sessionClient = await createSessionClient();
    const { data: userData, error: userError } = await sessionClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return { ok: false };

    const supabase = getServerSupabase();
    if (supabase) {
      const { data } = await supabase.from('profiles').select('id,role').eq('id', userId).single();
      if (data?.role) return { ok: true, role: data.role };
    }

    const metadataRole =
      resolveRequesterRole(userData.user?.app_metadata?.role) ??
      resolveRequesterRole(userData.user?.user_metadata?.role);
    if (metadataRole) return { ok: true, role: metadataRole };

    return { ok: false };
  } catch {
    return { ok: false };
  }
}

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

  const requester = await getRequester(req);
  const allowedRoles = ['admin', 'superadmin'];
  if (!requester.ok || !allowedRoles.includes(requester.role as string)) {
    return NextResponse.json({ error: 'forbidden: insufficient permissions' }, { status: 403 });
  }

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
