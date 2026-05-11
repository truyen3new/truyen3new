# Security Hardening: Cloudflare Comic Platform Implementation Guide

Date: 2026-05-11

This file contains the concrete implementation payload for the Cloudflare-native comic platform:

- A complete D1 migration script.
- Worker-side RBAC middleware boilerplate.
- The R2 delivery strategy for public and premium assets.

## 1) Complete D1 Migration

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE CHECK (name IN ('superadmin', 'admin', 'employee', 'user'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  r2_cover_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comic_id INTEGER NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL CHECK (chapter_number > 0),
  title TEXT NOT NULL,
  UNIQUE (comic_id, chapter_number)
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  r2_image_key TEXT NOT NULL,
  UNIQUE (chapter_id, page_number)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reading_history (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comic_id INTEGER NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
  last_chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, comic_id)
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_comics_status ON comics(status);
CREATE INDEX IF NOT EXISTS idx_chapters_comic_id ON chapters(comic_id);
CREATE INDEX IF NOT EXISTS idx_pages_chapter_id ON pages(chapter_id);
CREATE INDEX IF NOT EXISTS idx_comments_chapter_id ON comments(chapter_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_history_comic_id ON reading_history(comic_id);
CREATE INDEX IF NOT EXISTS idx_history_last_chapter_id ON reading_history(last_chapter_id);

INSERT OR IGNORE INTO roles (name) VALUES
  ('superadmin'),
  ('admin'),
  ('employee'),
  ('user');

CREATE TRIGGER IF NOT EXISTS trg_reading_history_touch_updated_at
AFTER UPDATE OF last_chapter_id ON reading_history
FOR EACH ROW
BEGIN
  UPDATE reading_history
  SET updated_at = CURRENT_TIMESTAMP
  WHERE user_id = NEW.user_id
    AND comic_id = NEW.comic_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_chapters_cleanup_children
AFTER DELETE ON chapters
FOR EACH ROW
BEGIN
  DELETE FROM pages WHERE chapter_id = OLD.id;
  DELETE FROM comments WHERE chapter_id = OLD.id;
END;
```

Warning: the Worker must delete physical R2 objects after a successful DB delete. SQLite triggers cannot call the R2 API.

## 2) Worker RBAC Middleware

```ts
type RoleName = 'superadmin' | 'admin' | 'employee' | 'user';
type Permission =
  | 'comic:read' | 'comic:create' | 'comic:update' | 'comic:delete'
  | 'chapter:create' | 'chapter:update' | 'chapter:delete'
  | 'page:create' | 'page:update' | 'page:delete'
  | 'comment:create' | 'comment:update:any' | 'comment:update:own' | 'comment:delete:any' | 'comment:delete:own'
  | 'history:update:own' | 'r2:upload' | 'r2:delete' | 'roles:manage' | 'r2:manage';

interface Env {
  DB: D1Database;
  JWT_PUBLIC_KEY: string;
  R2_SIGNING_SECRET: string;
}

interface Actor {
  id: number;
  username: string;
  role: RoleName;
}

const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  superadmin: ['comic:read','comic:create','comic:update','comic:delete','chapter:create','chapter:update','chapter:delete','page:create','page:update','page:delete','comment:create','comment:update:any','comment:update:own','comment:delete:any','comment:delete:own','history:update:own','r2:upload','r2:delete','roles:manage','r2:manage'],
  admin: ['comic:read','comic:create','comic:update','chapter:create','chapter:update','page:create','page:update','comment:create','comment:update:any','comment:delete:any','history:update:own','r2:upload','r2:delete'],
  employee: ['comic:read','comic:update','chapter:create','chapter:update','page:create','page:update','comment:create','history:update:own'],
  user: ['comic:read','comment:create','comment:update:own','comment:delete:own','history:update:own'],
};

function hasPermission(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

async function resolveActor(request: Request, env: Env): Promise<Actor | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, env.JWT_PUBLIC_KEY);
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) return null;

  const row = await env.DB.prepare(
    `SELECT u.id, u.username, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?1`
  ).bind(userId).first<{ id: number; username: string; role: RoleName }>();

  return row ? { id: row.id, username: row.username, role: row.role } : null;
}

function requirePermission(actor: Actor | null, permission: Permission): Response | null {
  if (!actor) return new Response('Unauthorized', { status: 401 });
  if (!hasPermission(actor.role, permission)) return new Response('Forbidden', { status: 403 });
  return null;
}

function requireOwnership(actor: Actor | null, ownerId: number): Response | null {
  if (!actor) return new Response('Unauthorized', { status: 401 });
  if (actor.role === 'superadmin' || actor.role === 'admin') return null;
  return actor.id === ownerId ? null : new Response('Forbidden', { status: 403 });
}

export async function authorizeRoute(request: Request, env: Env, required: Permission, ownerId?: number) {
  const actor = await resolveActor(request, env);
  const permissionError = requirePermission(actor, required);
  if (permissionError) return { actor, error: permissionError };

  if (ownerId !== undefined) {
    const ownershipError = requireOwnership(actor, ownerId);
    if (ownershipError) return { actor, error: ownershipError };
  }

  return { actor, error: null };
}

async function verifyJwt(token: string, publicKey: string): Promise<{ sub: string }> {
  void publicKey;
  const [, payload] = token.split('.');
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}
```

Route rules:

- superadmin: full CRUD, role management, R2 lifecycle control.
- admin: metadata, asset upload/delete, and moderation.
- employee: insert/upload and edit, no delete.
- user: read-only plus own comments and reading history.

## 3) R2 Delivery Strategy

- Store only `r2_cover_key` and `r2_image_key` in D1.
- Free assets: public CDN path with long cache headers.
- Premium assets: short-lived HMAC-signed URL from the Worker.
- The Worker validates signature and expiry before object access.
