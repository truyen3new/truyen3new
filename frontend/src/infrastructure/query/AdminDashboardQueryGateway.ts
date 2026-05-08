import { getServerSupabase } from '@/lib/supabase/server';
import type { DashboardDataDTO, OverviewMetricsDTO } from '@/application/dtos/dashboard';

function emptyDashboardData(): DashboardDataDTO {
  return {
    stories: [],
    stats: { totalViews: 0, activeStories: 0, totalChapters: 0 },
    syncedAt: new Date().toISOString(),
  };
}

export class AdminDashboardQueryGateway {
  async loadDashboardData(): Promise<DashboardDataDTO> {
    return emptyDashboardData();
  }

  async loadOverviewMetrics(): Promise<OverviewMetricsDTO> {
    const supabase = getServerSupabase();
    if (!supabase) {
      return {
        profileCount: 0,
        chapterCount: 0,
        adSettingsCount: 0,
        roleDistribution: [],
      };
    }

    const [profilesResult, chaptersResult, settingsResult, rolesResult] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('chapters').select('id', { count: 'exact', head: true }),
      supabase.from('site_settings').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('role'),
    ]);

    const counts = new Map<string, number>();
    for (const row of rolesResult.data ?? []) {
      const role = ((row as { role?: string | null }).role || 'user').trim();
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }

    return {
      profileCount: profilesResult.count ?? 0,
      chapterCount: chaptersResult.count ?? 0,
      adSettingsCount: settingsResult.count ?? 0,
      roleDistribution: Array.from(counts.entries())
        .map(([role, total]) => ({ role, total }))
        .sort((a, b) => b.total - a.total),
    };
  }
}