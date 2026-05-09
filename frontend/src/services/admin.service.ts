import { supabase } from '@/lib/supabase/client';
import { AdminDashboardQueryGateway } from '@/infrastructure/query/AdminDashboardQueryGateway';

const dashboardGateway = new AdminDashboardQueryGateway();

async function getAuthHeaders(): Promise<Record<string, string>> {
  let accessToken: string | null = null;

  try {
    if (supabase) {
      const sessionResult = await supabase.auth.getSession();
      accessToken = sessionResult.data.session?.access_token ?? null;
    }
  } catch {
    accessToken = null;
  }

  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

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
  const authHeaders = await getAuthHeaders();
  const res = await fetch('/api/internal/admin/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    credentials: 'include',
    body: JSON.stringify({ action: 'updateRole', id, role }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error ?? `Request failed ${res.status}`);
  }
  const json = await res.json().catch(() => null);
  if (json && json.ok === false && json.skipped) {
    throw new Error(json.skipped || 'server-supabase-missing');
  }
  return { ok: true };
}

export async function updateProfileName(id: string, full_name: string | null) {
  const authHeaders = await getAuthHeaders();
  const res = await fetch('/api/internal/admin/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    credentials: 'include',
    body: JSON.stringify({ action: 'updateName', id, full_name }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error ?? `Request failed ${res.status}`);
  }
  const json = await res.json().catch(() => null);
  if (json && json.ok === false && json.skipped) {
    throw new Error(json.skipped || 'server-supabase-missing');
  }
  return { ok: true };
}

export async function callManageUserFunction(body: Record<string, unknown>) {
  // Use the internal server route first; fall back to the Supabase Edge Function when local
  // service-role configuration is missing or a mock server client is returned.
  let accessToken: string | null = null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  try {
    if (supabase) {
      const sessionResult = await supabase.auth.getSession();
      accessToken = sessionResult.data.session?.access_token ?? null;
    }
  } catch {
    accessToken = null;
  }

  const response = await fetch('/api/internal/admin/manage-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({ raw: '' }));
  if (!response.ok) {
    const errorMessage = json?.error ?? `Request failed ${response.status}`;
    const shouldFallbackToEdgeFunction =
      response.status >= 500 &&
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

    return { data: json, error: new Error(errorMessage) };
  }
  return { data: json, error: null };
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
