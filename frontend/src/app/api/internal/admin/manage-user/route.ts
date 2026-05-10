import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuthorization } from '../_auth';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuthorization(request);
  if (!auth.ok) return auth.response;

  const requester = auth.requester;

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'server-supabase-missing' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const action = body?.action;

  try {
    if (action === 'create') {
      if (requester.role !== 'superadmin' && requester.role !== 'admin' && requester.role !== 'internal') {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }

      const email = typeof body?.email === 'string' ? body.email.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
      const role = typeof body?.role === 'string' ? body.role : 'user';

      const creatableRoles = requester.role === 'admin'
        ? new Set(['user', 'employee'])
        : new Set(['user', 'employee', 'admin']);

      if (!email || password.length < 6) {
        return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
      }

      if (!creatableRoles.has(role)) {
        return NextResponse.json({ error: 'role is not allowed for your account type' }, { status: 403 });
      }

      const created = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || undefined,
        },
      });

      if (created.error || !created.data.user?.id) {
        throw created.error ?? new Error('createUser failed');
      }

      const userId = created.data.user.id;
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: fullName || null,
        role,
      });

      if (profileError) {
        await supabase.auth.admin.deleteUser(userId);
        throw profileError;
      }

      await supabase.from('admin_audit_logs').insert({
        actor_user_id: requester.id,
        action: 'user_create',
        target_user_id: userId,
        target_email: email,
        metadata: { assignedRole: role },
      });

      return NextResponse.json({ userId, email, role });
    }

    if (action === 'delete') {
      if (requester.role !== 'superadmin' && requester.role !== 'internal') {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }

      const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
      const targetEmail = typeof body?.targetEmail === 'string' ? body.targetEmail.trim() : null;
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      if (requester.id && userId === requester.id) {
        return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
      }

      const deleted = await supabase.auth.admin.deleteUser(userId, true);
      if (deleted.error) throw deleted.error;

      await supabase.from('admin_audit_logs').insert({
        actor_user_id: requester.id,
        action: 'user_delete',
        target_user_id: userId,
        target_email: targetEmail,
      });

      return NextResponse.json({ deleted: true, userId });
    }

    return NextResponse.json({ error: 'action must be one of: create, delete' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'internal' }, { status: 500 });
  }
}