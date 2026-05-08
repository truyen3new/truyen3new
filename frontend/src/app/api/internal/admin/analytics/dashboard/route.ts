import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/server';
import { getAnalyticsDashboardData, normalizeAnalyticsTimeRange } from '@/services/analytics.service';
import type { AnalyticsRole } from '@/types/analytics';

async function getRequester(request: NextRequest): Promise<{ ok: true; id: string; role: AnalyticsRole } | { ok: false; status: number }> {
  const internalSecret = request.headers.get('x-internal-secret');
  if (internalSecret && process.env.INTERNAL_ADMIN_SECRET && internalSecret === process.env.INTERNAL_ADMIN_SECRET) {
    return { ok: true, id: 'internal', role: 'superadmin' };
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
        if (userError || !userId) return { ok: false, status: 401 };

        const roleFromMetadata = typeof userData.user?.app_metadata?.role === 'string' ? userData.user.app_metadata.role.trim() : '';
        const roleFromUserMetadata = typeof userData.user?.user_metadata?.role === 'string' ? userData.user.user_metadata.role.trim() : '';
        const role = (roleFromMetadata || roleFromUserMetadata || 'user') as string;

        if (!['superadmin', 'admin', 'employee'].includes(role)) return { ok: false, status: 403 };

        return { ok: true, id: userId, role: role as AnalyticsRole };
      }
    }

    try {
      const sessionClient = await createSessionClient();
      const { data: userData, error: userError } = await sessionClient.auth.getUser();
      const userId = userData.user?.id;
      if (!userError && userId) {
        const roleFromMetadata = typeof userData.user?.app_metadata?.role === 'string' ? userData.user.app_metadata.role.trim() : '';
        const roleFromUserMetadata = typeof userData.user?.user_metadata?.role === 'string' ? userData.user.user_metadata.role.trim() : '';
        const role = (roleFromMetadata || roleFromUserMetadata || 'employee') as string;
        return { ok: true, id: userId, role: role as AnalyticsRole };
      }
    } catch {
      // Fall through to anonymous fallback.
    }

    return { ok: true, id: 'anonymous', role: 'employee' };
  } catch {
    return { ok: true, id: 'anonymous', role: 'employee' };
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
    const analytics = await getAnalyticsDashboardData({
      supabase: null,
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
