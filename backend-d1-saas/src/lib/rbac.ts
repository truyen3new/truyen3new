type RoleName = 'superadmin' | 'admin' | 'employee' | 'user';

type Permission =
  | 'tables:crud:all'
  | 'roles:manage:admin'
  | 'r2:bucket:lifecycle'
  | 'comics:create'
  | 'comics:update'
  | 'comics:delete'
  | 'comics:metadata:manage'
  | 'chapters:create'
  | 'chapters:update'
  | 'chapters:delete'
  | 'chapters:metadata:manage'
  | 'pages:create'
  | 'pages:update'
  | 'pages:delete'
  | 'r2:assets:upload'
  | 'r2:assets:delete'
  | 'comments:moderate'
  | 'chapters:insert'
  | 'pages:insert'
  | 'metadata:edit'
  | 'comments:own:manage'
  | 'reading_history:own:manage'
  | 'audit_logs:read'
  | 'stories:read';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface RbacEnv {
  CONTROL_DB: D1Database;
}

interface IdentityClaims {
  sub: string;
  role?: string;
}

interface IdentityContext {
  userId: number;
  role: RoleName;
}

const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  superadmin: [
    'tables:crud:all',
    'roles:manage:admin',
    'r2:bucket:lifecycle',
    'comics:create',
    'comics:update',
    'comics:delete',
    'comics:metadata:manage',
    'chapters:create',
    'chapters:update',
    'chapters:delete',
    'chapters:metadata:manage',
    'pages:create',
    'pages:update',
    'pages:delete',
    'r2:assets:upload',
    'r2:assets:delete',
    'comments:moderate',
    'chapters:insert',
    'pages:insert',
    'metadata:edit',
    'comments:own:manage',
    'reading_history:own:manage',
    'audit_logs:read',
    'stories:read',
  ],
  admin: [
    'comics:create',
    'comics:update',
    'comics:delete',
    'comics:metadata:manage',
    'chapters:create',
    'chapters:update',
    'chapters:delete',
    'chapters:metadata:manage',
    'pages:create',
    'pages:update',
    'pages:delete',
    'r2:assets:upload',
    'r2:assets:delete',
    'comments:moderate',
    'chapters:insert',
    'pages:insert',
    'metadata:edit',
    'audit_logs:read',
    'stories:read',
  ],
  employee: [
    'chapters:create',
    'chapters:update',
    'pages:create',
    'pages:update',
    'chapters:insert',
    'pages:insert',
    'metadata:edit',
    'stories:read',
  ],
  user: [
    'comments:own:manage',
    'reading_history:own:manage',
    'stories:read',
  ],
};

function normalizeRole(value: string): RoleName | null {
  if (value === 'superadmin' || value === 'admin' || value === 'employee' || value === 'user') {
    return value;
  }

  return null;
}

function decodeBase64UrlToJson<T>(payload: string): T {
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(paddingLength);
  return JSON.parse(atob(padded)) as T;
}

function parseBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim();
}

function parseClaimsFromJwt(token: string): IdentityClaims | null {
  const tokenParts = token.split('.');
  if (tokenParts.length < 2) {
    return null;
  }

  const payloadPart = tokenParts[1];
  if (!payloadPart) {
    return null;
  }

  try {
    return decodeBase64UrlToJson<IdentityClaims>(payloadPart);
  } catch {
    return null;
  }
}

async function resolveRoleFromDatabase(env: RbacEnv, userId: number): Promise<RoleName | null> {
  try {
    const row = await env.CONTROL_DB
      .prepare(
        `SELECT r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?1`
      )
      .bind(userId)
      .first<{ role: string }>();

    return row ? normalizeRole(row.role) : null;
  } catch {
    // If the role tables are not migrated yet, fallback to JWT claim role.
    return null;
  }
}

export async function resolveIdentity(request: Request, env: RbacEnv): Promise<IdentityContext | null> {
  const token = parseBearerToken(request);
  if (!token) {
    return null;
  }

  const claims = parseClaimsFromJwt(token);
  if (!claims || !claims.sub) {
    return null;
  }

  const userId = Number(claims.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const roleFromDb = await resolveRoleFromDatabase(env, userId);
  if (roleFromDb) {
    return { userId, role: roleFromDb };
  }

  const roleFromClaims = claims.role ? normalizeRole(claims.role) : null;
  if (!roleFromClaims) {
    return null;
  }

  return { userId, role: roleFromClaims };
}

export function hasPermission(identity: IdentityContext | null, permission: Permission): boolean {
  if (!identity) {
    return false;
  }

  return ROLE_PERMISSIONS[identity.role].includes(permission);
}

export function requirePermission(identity: IdentityContext | null, permission: Permission): Response | null {
  if (!identity) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!hasPermission(identity, permission)) {
    return new Response('Forbidden', { status: 403 });
  }

  return null;
}

export function requireOwnership(identity: IdentityContext | null, ownerUserId: number): Response | null {
  if (!identity) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (identity.role === 'superadmin' || identity.role === 'admin') {
    return null;
  }

  if (identity.userId !== ownerUserId) {
    return new Response('Forbidden', { status: 403 });
  }

  return null;
}

export type { IdentityContext, Permission, RbacEnv, RoleName };
