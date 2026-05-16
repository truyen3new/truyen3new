import { supabase } from '@/infrastructure/supabase/client';
import { apiClient } from '@/lib/apiClient';
import { AdminDashboardQueryGateway } from '@/infrastructure/query/AdminDashboardQueryGateway';

const dashboardGateway = new AdminDashboardQueryGateway();

export async function logDashboardAccess(actorUserId: string) {
  void actorUserId;
}

export async function getDashboardData() {
  void supabase;
  return dashboardGateway.loadDashboardData();
}

export async function getUiSettings() {
  void supabase;
  return { compactMode: false, showSyncBadge: true };
}

export async function getStoriesFieldValues(field: 'category_id' | 'author_id') {
  if (!supabase) return [] as Array<Record<string, string | null>>;

  const { data, error } = await supabase.from('stories').select(field).limit(1000);
  if (error) return [] as Array<Record<string, string | null>>;
  return (data ?? []) as Array<Record<string, string | null>>;
}

export async function getProfileCount() {
  return dashboardGateway.loadOverviewMetrics().then((metrics) => metrics.profileCount);
}

export async function getChapterCount() {
  return dashboardGateway.loadOverviewMetrics().then((metrics) => metrics.chapterCount);
}

export async function getAdSettingsCount() {
  return dashboardGateway.loadOverviewMetrics().then((metrics) => metrics.adSettingsCount);
}

export async function getRoleDistribution() {
  return dashboardGateway.loadOverviewMetrics().then((metrics) => metrics.roleDistribution);
}

export default {};

export async function fetchProfiles() {
  if (!supabase) return [] as Array<any>;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,role,full_name')
    .order('role', { ascending: true })
    .limit(500);
  if (error) return [] as Array<any>;
  return (data ?? []) as Array<any>;
}

export async function updateProfileRole(id: string, role: string) {
  const result = await apiClient.post<{ ok: boolean }>('/api/admin/profiles', { action: 'updateRole', id, role });
  return result;
}

export async function updateProfileName(id: string, full_name: string | null) {
  const result = await apiClient.post<{ ok: boolean }>('/api/admin/profiles', { action: 'updateName', id, full_name });
  return result;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const sbKeys = Object.keys(localStorage).filter((k) =>
      k.startsWith('sb-') && k.endsWith('-auth-token'),
    );
    if (sbKeys.length === 0) return null;
    const raw = localStorage.getItem(sbKeys[0]);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function callManageUserFunction(body: Record<string, unknown>) {
  const accessToken = getAccessToken();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  try {
    const data = await apiClient.post<any>('/api/admin/manage-user', body);
    return { data, error: null };
  } catch (err: any) {
    const errorMessage = err?.message ?? 'Request failed';
    const shouldFallbackToEdgeFunction =
      err?.status >= 500 &&
      /server supabase unavailable|createUser failed|createUser exception|Internal error|Cannot read properties of undefined/i.test(errorMessage);

    if (shouldFallbackToEdgeFunction && supabaseUrl && supabaseKey && accessToken) {
      const edgeResponse = await fetch(`${supabaseUrl}/functions/v1/manage-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const edgeJson = await edgeResponse.json().catch(() => ({ raw: '' }));
      if (!edgeResponse.ok) {
        return { data: edgeJson, error: new Error(edgeJson?.error ?? `Request failed ${edgeResponse.status}`) };
      }

      return { data: edgeJson, error: null };
    }

    return { data: null, error: err instanceof Error ? err : new Error(errorMessage) };
  }
}

export async function getAuditLogs(limit = 200) {
  if (!supabase) return [] as Array<any>;

  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('id,actor_user_id,action,target_user_id,target_email,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [] as Array<any>;
  return (data ?? []) as Array<any>;
}

export async function getProfilesByIds(ids: string[]) {
  if (ids.length === 0) return [] as Array<any>;

  if (!supabase) return [] as Array<any>;

  const { data, error } = await supabase.from('profiles').select('id,email,full_name').in('id', ids);
  if (error) return [] as Array<any>;
  return (data ?? []) as Array<any>;
}
