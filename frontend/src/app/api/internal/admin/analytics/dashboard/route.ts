import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSessionClient } from '@/lib/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAnalyticsDashboardData, normalizeAnalyticsTimeRange } from '@/services/analytics.service';
import type { AnalyticsRole } from '@/types/analytics';

async function getRequester(request: NextRequest): Promise<{ ok: true; id: string; role: AnalyticsRole } | { ok: false; status: number }> {
  const internalSecret = request.headers.get('x-internal-secret');
  if (internalSecret && process.env.INTERNAL_ADMIN_SECRET && internalSecret === process.env.INTERNAL_ADMIN_SECRET) {
    return { ok: true, id: 'internal', role: 'superadmin' };
  }

  try {
    const sessionClient = await createSessionClient();
    const { data: userData, error: userError } = await sessionClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return { ok: false, status: 401 };

    const supabase = getServerSupabase();
    if (!supabase) return { ok: false, status: 500 };

    const { data } = await supabase.from('profiles').select('id,role').eq('id', userId).single();
    const role = (data?.role ?? 'user') as string;
    if (!['superadmin', 'admin', 'employee'].includes(role)) return { ok: false, status: 403 };

    return { ok: true, id: userId, role: role as AnalyticsRole };
  } catch {
    return { ok: false, status: 401 };
  }
}

export async function GET(request: NextRequest) {
  const requester = await getRequester(request);
  if (!requester.ok) {
    return NextResponse.json({ error: requester.status === 403 ? 'forbidden' : 'unauthorized' }, { status: requester.status });
  }

  const url = new URL(request.url);
  const range = normalizeAnalyticsTimeRange(url.searchParams.get('range'));

  try {
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'server-supabase-missing' }, { status: 500 });
    }

    const analytics = await getAnalyticsDashboardData({
      supabase,
      range,
      role: requester.role,
    });

    return NextResponse.json(analytics, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'aggregation-failure' },
      { status: 500 },
    );
  }
}
