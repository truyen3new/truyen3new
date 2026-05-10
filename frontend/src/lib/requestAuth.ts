import { supabase } from '@/lib/supabase/client';

export async function getPrivilegedAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};

  try {
    await supabase.auth.getUser();
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token ?? null;
    if (accessToken) return { Authorization: `Bearer ${accessToken}` };
  } catch {
    // Fall back to the cached session below.
  }

  try {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token ?? null;
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  } catch {
    return {};
  }
}

// For development environments we allow an explicit client-exposed internal secret
// to be sent for server-side routes. This must be set as `NEXT_PUBLIC_INTERNAL_ADMIN_SECRET`
// in the frontend environment to opt-in. We merge this into privileged headers when present.
function getInternalSecretHeader(): Record<string, string> {
  const secret = process.env.NEXT_PUBLIC_INTERNAL_ADMIN_SECRET ?? '';
  if (secret && secret.trim()) return { 'x-internal-secret': secret.trim() };
  return {};
}

// Exported helper that callers can use to include both auth and optional internal secret.
export async function getPrivilegedAuthHeadersWithInternal(): Promise<Record<string, string>> {
  const headers = await getPrivilegedAuthHeaders().catch(() => ({}));
  // Prefer an actual bearer token when present. Only include the client-exposed
  // `x-internal-secret` fallback when no bearer token is available. This avoids
  // triggering the server-side "internal" flow (which requires a service-role
  // key) when the user is already signed in as an admin.
  if (headers.Authorization) return headers;
  return { ...headers, ...getInternalSecretHeader() };
}
