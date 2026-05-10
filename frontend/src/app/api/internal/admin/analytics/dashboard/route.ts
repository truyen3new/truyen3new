import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsDashboardData, normalizeAnalyticsTimeRange } from '@/services/analytics.service';
import type { AnalyticsRole } from '@/types/analytics';

import { requireAdminAuthorization } from '../../_auth';

async function getRequester(request: NextRequest): Promise<{ ok: true; id: string; role: AnalyticsRole } | { ok: false; status: number }> {
  const auth = await requireAdminAuthorization(request, {
    allowAnonymousFallback: true,
    anonymousRole: 'employee',
    allowedRoles: ['superadmin', 'admin', 'employee', 'internal'],
  });
  if (!auth.ok) return { ok: false, status: auth.response.status };

  const role = (auth.requester.role === 'internal' ? 'admin' : auth.requester.role) as AnalyticsRole;
  if (!['superadmin', 'admin', 'employee'].includes(role)) return { ok: false, status: 403 };

  return { ok: true, id: auth.requester.id, role };
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
