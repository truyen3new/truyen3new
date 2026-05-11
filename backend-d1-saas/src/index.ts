interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run<T = Record<string, unknown>>(): Promise<T>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  CONTROL_DB: D1Database;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  TENANT_DATABASE_PREFIX: string;
  ADMIN_API_KEY: string;
  ENABLE_LOCAL_DEV_FALLBACK?: string;
}

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  database_id: string;
  database_name: string;
  api_key_hash: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface StoryRow {
  id: string;
  title: string;
  slug: string;
  description: string;
  cover_url: string;
  status: string;
  scheduled_at: string | null;
  view_count: number;
  author: string;
  category: string;
  genres: string;
  tags: string;
  artist: string;
  translator: string;
  source: string;
  rank_score: number;
  created_at: string;
  updated_at: string;
}

interface ChapterRow {
  id: string;
  story_id: string;
  chapter_number: number;
  title: string;
  status: string;
  scheduled_at: string | null;
  content: string;
  view_count: number;
  created_at: string;
  updated_at: string;
}

interface AuditLogRow {
  id: string;
  actor_id: number | null;
  action: string;
  target_type: string;
  target_id: string;
  changes: string;
  timestamp: string;
}

interface CloudflareApiResponse<T> {
  success: boolean;
  errors?: Array<{ code?: number; message: string }>;
  result?: T;
}

interface ProvisionedDatabase {
  id: string;
  name: string;
}

import { hasPermission, requirePermission, resolveIdentity } from './lib/rbac';
import { createErrorResponse, createJsonResponse, jsonHeaders } from './shared/core';

const TENANT_SCHEMA_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', cover_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'archived')), scheduled_at TEXT, view_count INTEGER NOT NULL DEFAULT 0, author TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '[]', genres TEXT NOT NULL DEFAULT '[]', tags TEXT NOT NULL DEFAULT '[]', artist TEXT NOT NULL DEFAULT '', translator TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', rank_score REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  "CREATE INDEX IF NOT EXISTS idx_stories_slug ON stories (slug)",
  "CREATE INDEX IF NOT EXISTS idx_stories_status ON stories (status)",
  "CREATE INDEX IF NOT EXISTS idx_stories_scheduled_at ON stories (scheduled_at)",
  "CREATE INDEX IF NOT EXISTS idx_stories_rank_score ON stories (rank_score DESC)",
  "CREATE INDEX IF NOT EXISTS idx_stories_updated_at ON stories (updated_at DESC)",
  "CREATE TABLE IF NOT EXISTS chapters (id TEXT PRIMARY KEY, story_id TEXT NOT NULL REFERENCES stories (id) ON DELETE CASCADE, chapter_number INTEGER NOT NULL CHECK (chapter_number > 0), title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'archived')), scheduled_at TEXT, content TEXT NOT NULL DEFAULT '', view_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (story_id, chapter_number))",
  "CREATE INDEX IF NOT EXISTS idx_chapters_story_id ON chapters (story_id)",
  "CREATE INDEX IF NOT EXISTS idx_chapters_story_number ON chapters (story_id, chapter_number)",
  "CREATE INDEX IF NOT EXISTS idx_chapters_status ON chapters (status)",
  "CREATE INDEX IF NOT EXISTS idx_chapters_scheduled_at ON chapters (scheduled_at)",
  "CREATE INDEX IF NOT EXISTS idx_chapters_updated_at ON chapters (updated_at DESC)",
  "CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, changes TEXT NOT NULL, timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_type, target_id)",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_timestamp ON audit_logs (actor_id, timestamp DESC)",
  "CREATE TRIGGER IF NOT EXISTS trg_chapters_sync_story_views_after_insert AFTER INSERT ON chapters BEGIN UPDATE stories SET view_count = (SELECT COALESCE(SUM(view_count), 0) FROM chapters WHERE story_id = NEW.story_id), updated_at = CURRENT_TIMESTAMP WHERE id = NEW.story_id; END",
  "CREATE TRIGGER IF NOT EXISTS trg_chapters_sync_story_views_after_update AFTER UPDATE OF view_count, story_id ON chapters BEGIN UPDATE stories SET view_count = (SELECT COALESCE(SUM(view_count), 0) FROM chapters WHERE story_id = NEW.story_id), updated_at = CURRENT_TIMESTAMP WHERE id = NEW.story_id; UPDATE stories SET view_count = (SELECT COALESCE(SUM(view_count), 0) FROM chapters WHERE story_id = OLD.story_id), updated_at = CURRENT_TIMESTAMP WHERE id = OLD.story_id AND OLD.story_id <> NEW.story_id; END",
  "CREATE TRIGGER IF NOT EXISTS trg_chapters_sync_story_views_after_delete AFTER DELETE ON chapters BEGIN UPDATE stories SET view_count = (SELECT COALESCE(SUM(view_count), 0) FROM chapters WHERE story_id = OLD.story_id), updated_at = CURRENT_TIMESTAMP WHERE id = OLD.story_id; END",
];

const TENANT_SCHEMA_STATEMENTS_LOCAL = [
  "CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', cover_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', scheduled_at TEXT, view_count INTEGER NOT NULL DEFAULT 0, author TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '[]', genres TEXT NOT NULL DEFAULT '[]', tags TEXT NOT NULL DEFAULT '[]', artist TEXT NOT NULL DEFAULT '', translator TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', rank_score REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  "CREATE INDEX IF NOT EXISTS idx_stories_slug ON stories (slug)",
  "CREATE INDEX IF NOT EXISTS idx_stories_status ON stories (status)",
  "CREATE TABLE IF NOT EXISTS chapters (id TEXT PRIMARY KEY, story_id TEXT NOT NULL, chapter_number INTEGER NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', scheduled_at TEXT, content TEXT NOT NULL DEFAULT '', view_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  "CREATE INDEX IF NOT EXISTS idx_chapters_story_id ON chapters (story_id)",
  "CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, changes TEXT NOT NULL, timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_type, target_id)",
];

function jsonResponse(body: unknown, status = 200): Response {
  return createJsonResponse(body, status);
}

function errorResponse(message: string, status: number, details?: unknown): Response {
  return createErrorResponse(message, status, details);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "tenant";
}

function normalizePath(pathname: string): string[] {
  return pathname.replace(/\/+$/u, "").split("/").filter(Boolean);
}

function hexFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return hexFromBytes(new Uint8Array(digest));
}

function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

function buildTenantDatabaseName(env: Env, tenantSlug: string, tenantId: string): string {
  return `${env.TENANT_DATABASE_PREFIX}-${tenantSlug}-${tenantId.slice(0, 8)}`;
}

function requireAdmin(request: Request, env: Env): Response | null {
  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || !env.ADMIN_API_KEY || !constantTimeEquals(adminKey, env.ADMIN_API_KEY)) {
    return errorResponse("Unauthorized admin request", 401);
  }
  return null;
}

async function requireTenant(tenant: TenantRow, request: Request): Promise<Response | null> {
  const tenantKey = request.headers.get("x-tenant-key");
  if (!tenantKey) {
    return errorResponse("Missing x-tenant-key header", 401);
  }

  const candidateHash = await sha256Hex(tenantKey);
  if (!constantTimeEquals(candidateHash, tenant.api_key_hash)) {
    return errorResponse("Unauthorized tenant request", 403);
  }

  return null;
}

async function readJsonBody<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text.trim()) {
    throw new Error("Request body is required");
  }
  return JSON.parse(text) as T;
}

function parseStringField(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

function optionalStringField(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return value;
}

function optionalJsonStringField(value: unknown, fallback = "[]"): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }

    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      throw new Error("category must be valid JSON");
    }
  }

  if (value === undefined || value === null) {
    return fallback;
  }

  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    return fallback;
  }

  return serialized;
}

function normalizeChapterContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return JSON.stringify(value);
  }

  return "";
}

function normalizeLifecycleStatus(value: unknown, fallback: string = "draft"): string {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "ongoing") {
    return "published";
  }

  if (normalized === "completed") {
    return "archived";
  }

  if (normalized === "draft" || normalized === "pending" || normalized === "published" || normalized === "archived") {
    return normalized;
  }

  throw new Error("status must be draft, pending, published, or archived");
}

function optionalStringOrNullField(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalNumberField(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return value;
}

function normalizeJsonArrayField(value: unknown, fallback = "[]"): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }

    JSON.parse(trimmed);
    return trimmed;
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return fallback;
}

async function requireAnyRolePermission(
  request: Request,
  env: Env,
  permissions: readonly Parameters<typeof hasPermission>[1][],
): Promise<{ identity: Awaited<ReturnType<typeof resolveIdentity>>; error: Response | null }> {
  if (permissions.length === 0) {
    return {
      identity: null,
      error: new Response("Forbidden", { status: 403, headers: jsonHeaders }),
    };
  }

  const identity = await resolveIdentity(request, env);
  if (!identity) {
    return {
      identity: null,
      error: new Response("Unauthorized", { status: 401, headers: jsonHeaders }),
    };
  }

  for (const permission of permissions) {
    if (hasPermission(identity, permission)) {
      return { identity, error: null };
    }
  }

  const [firstPermission] = permissions;
  if (!firstPermission) {
    return {
      identity,
      error: new Response("Forbidden", { status: 403, headers: jsonHeaders }),
    };
  }

  const denied = requirePermission(identity, firstPermission);
  if (!denied) {
    return {
      identity,
      error: new Response("Forbidden", { status: 403, headers: jsonHeaders }),
    };
  }

  return {
    identity,
    error: new Response(denied.body, {
      status: denied.status,
      headers: jsonHeaders,
    }),
  };
}

class CloudflareD1AdminClient {
  constructor(private readonly env: Env) {}

  private apiUrl(path: string): string {
    return `https://api.cloudflare.com/client/v4/${path}`;
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    // Local dev fallback: route D1 queries to the local CONTROL_DB when enabled
    const localFallback = this.env.ENABLE_LOCAL_DEV_FALLBACK === "true" || this.env.ENABLE_LOCAL_DEV_FALLBACK === "1";
    if (localFallback) {
      // Attempt to execute the SQL via CONTROL_DB if provided in body
      const sql = (body.sql as string) || "";
      const params = (body.params as unknown[]) || [];
      if (!sql) {
        return {} as T;
      }

      const stmt = this.env.CONTROL_DB.prepare(sql);
      const upper = sql.trim().slice(0, 6).toUpperCase();
      if (upper.startsWith("SELECT") || upper.startsWith("PRAGMA") || upper.startsWith("WITH")) {
        // @ts-ignore - D1PreparedStatement.all returns { results: T[] }
        return (await stmt.bind(...params).all()) as unknown as T;
      }

      // Non-select statements
      // @ts-ignore - D1PreparedStatement.run available
      await stmt.bind(...params).run();
      return {} as T;
    }

    const response = await fetch(this.apiUrl(path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as CloudflareApiResponse<T>;
    if (!response.ok || !payload.success || !payload.result) {
      const message = payload.errors?.[0]?.message ?? `${response.status} ${response.statusText}`;
      throw new Error(message);
    }

    return payload.result;
  }

  async createDatabase(name: string): Promise<ProvisionedDatabase> {
    const localFallback = this.env.ENABLE_LOCAL_DEV_FALLBACK === "true" || this.env.ENABLE_LOCAL_DEV_FALLBACK === "1";
    if (localFallback) {
      // In local dev, return a pseudo database id (use the name as id)
      return { id: name, name } as ProvisionedDatabase;
    }

    return this.post<ProvisionedDatabase>(`accounts/${this.env.CF_ACCOUNT_ID}/d1/database`, {
      name,
    });
  }

  async query(databaseId: string, sql: string, params: unknown[] = []): Promise<unknown> {
    const localFallback = this.env.ENABLE_LOCAL_DEV_FALLBACK === "true" || this.env.ENABLE_LOCAL_DEV_FALLBACK === "1";
    if (localFallback) {
      const stmt = this.env.CONTROL_DB.prepare(sql);
      const upper = sql.trim().slice(0, 6).toUpperCase();
      if (upper.startsWith("SELECT") || upper.startsWith("PRAGMA") || upper.startsWith("WITH")) {
        // @ts-ignore
        return await stmt.bind(...params).all();
      }

      // @ts-ignore
      return await stmt.bind(...params).run();
    }

    return this.post<unknown>(`accounts/${this.env.CF_ACCOUNT_ID}/d1/database/${databaseId}/query`, {
      sql,
      params,
    });
  }

  async bootstrapDatabase(databaseId: string): Promise<void> {
    const localFallback = this.env.ENABLE_LOCAL_DEV_FALLBACK === "true" || this.env.ENABLE_LOCAL_DEV_FALLBACK === "1";
    if (localFallback) {
      for (const statement of TENANT_SCHEMA_STATEMENTS_LOCAL) {
        const stmt = this.env.CONTROL_DB.prepare(statement);
        // @ts-ignore
        await stmt.run();
      }
      return;
    }

    for (const statement of TENANT_SCHEMA_STATEMENTS) {
      await this.query(databaseId, statement);
    }
  }
}

class ControlPlaneRepository {
  constructor(private readonly db: D1Database) {}

  async ensureSchema(): Promise<void> {
    await this.db.prepare(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, database_id TEXT NOT NULL, database_name TEXT NOT NULL, api_key_hash TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
    await this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status)`).run();
  }

  async createTenant(row: Omit<TenantRow, "created_at" | "updated_at">): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO tenants (id, slug, name, database_id, database_name, api_key_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(row.id, row.slug, row.name, row.database_id, row.database_name, row.api_key_hash, row.status)
      .run();
  }

  async listTenants(): Promise<TenantRow[]> {
    const result = await this.db
      .prepare(
        `SELECT id, slug, name, database_id, database_name, api_key_hash, status, created_at, updated_at FROM tenants ORDER BY created_at DESC`
      )
      .all<TenantRow>();

    return result.results;
  }

  async getTenantById(id: string): Promise<TenantRow | null> {
    return this.db
      .prepare(
        `SELECT id, slug, name, database_id, database_name, api_key_hash, status, created_at, updated_at FROM tenants WHERE id = ? LIMIT 1`
      )
      .bind(id)
      .first<TenantRow>();
  }

  async markReady(id: string): Promise<void> {
    await this.db
      .prepare(`UPDATE tenants SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(id)
      .run();
  }

  async updateTenantStatus(id: string, status: string): Promise<void> {
    await this.db
      .prepare(`UPDATE tenants SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(status, id)
      .run();
  }

  async deleteTenant(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM tenants WHERE id = ?`).bind(id).run();
  }

  async listFailedTenants(): Promise<Array<{ id: string; slug: string; status: string }>> {
    const result = await this.db
      .prepare(
        `SELECT id, slug, status FROM tenants WHERE status IN ('failed', 'failed_bootstrap', 'provisioning') AND CAST((julianday('now') - julianday(created_at)) * 86400 AS INTEGER) > 300 ORDER BY updated_at DESC`
      )
      .all<{ id: string; slug: string; status: string }>();

    return result.results;
  }
}

class TenantDatabaseClient {
  constructor(private readonly env: Env) {}

  private apiUrl(databaseId: string): string {
    return `https://api.cloudflare.com/client/v4/accounts/${this.env.CF_ACCOUNT_ID}/d1/database/${databaseId}/query`;
  }

  private async query<T>(databaseId: string, sql: string, params: unknown[] = []): Promise<T> {
    const localFallback = this.env.ENABLE_LOCAL_DEV_FALLBACK === "true" || this.env.ENABLE_LOCAL_DEV_FALLBACK === "1";
    if (localFallback) {
      const stmt = this.env.CONTROL_DB.prepare(sql);
      const upper = sql.trim().slice(0, 6).toUpperCase();
      if (upper.startsWith("SELECT") || upper.startsWith("PRAGMA") || upper.startsWith("WITH")) {
        // @ts-ignore
        return await stmt.bind(...params).all();
      }

      // @ts-ignore
      return await stmt.bind(...params).run();
    }

    const response = await fetch(this.apiUrl(databaseId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });

    const payload = (await response.json()) as CloudflareApiResponse<T>;
    if (!response.ok || !payload.success || payload.result === undefined) {
      const message = payload.errors?.[0]?.message ?? `${response.status} ${response.statusText}`;
      throw new Error(message);
    }

    return payload.result;
  }

  async listStories(databaseId: string): Promise<StoryRow[]> {
    const result = await this.query<{ results: StoryRow[] }>(
      databaseId,
      `SELECT id, title, slug, description, cover_url, status, scheduled_at, view_count, author, category, genres, tags, artist, translator, source, rank_score, created_at, updated_at FROM stories ORDER BY created_at DESC`,
    );
    return result.results;
  }

  async getStory(databaseId: string, id: string): Promise<StoryRow | null> {
    const result = await this.query<{ results: StoryRow[] }>(
      databaseId,
      `SELECT id, title, slug, description, cover_url, status, scheduled_at, view_count, author, category, genres, tags, artist, translator, source, rank_score, created_at, updated_at FROM stories WHERE id = ? LIMIT 1`,
      [id],
    );
    return result.results[0] ?? null;
  }

  async createStory(
    databaseId: string,
    story: Pick<StoryRow, "title" | "slug" | "description" | "cover_url" | "status" | "scheduled_at" | "author" | "category" | "genres" | "tags" | "artist" | "translator" | "source" | "rank_score">,
  ): Promise<StoryRow> {
    const id = crypto.randomUUID();
    const result = await this.query<{ results: StoryRow[] }>(
      databaseId,
      `INSERT INTO stories (id, title, slug, description, cover_url, status, scheduled_at, author, category, genres, tags, artist, translator, source, rank_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, title, slug, description, cover_url, status, scheduled_at, view_count, author, category, genres, tags, artist, translator, source, rank_score, created_at, updated_at`,
      [
        id,
        story.title,
        story.slug,
        story.description,
        story.cover_url,
        story.status,
        story.scheduled_at,
        story.author,
        story.category,
        story.genres,
        story.tags,
        story.artist,
        story.translator,
        story.source,
        story.rank_score,
      ],
    );
    const created = result.results[0];
    if (!created) {
      throw new Error("Failed to create story");
    }
    return created;
  }

  async listChapters(databaseId: string, storyId: string): Promise<ChapterRow[]> {
    const result = await this.query<{ results: ChapterRow[] }>(
      databaseId,
      `SELECT id, story_id, chapter_number, title, status, scheduled_at, content, view_count, created_at, updated_at FROM chapters WHERE story_id = ? ORDER BY chapter_number ASC`,
      [storyId],
    );
    return result.results;
  }

  async createChapter(
    databaseId: string,
    chapter: Pick<ChapterRow, "story_id" | "chapter_number" | "title" | "status" | "scheduled_at" | "content">,
  ): Promise<ChapterRow> {
    const id = crypto.randomUUID();
    const result = await this.query<{ results: ChapterRow[] }>(
      databaseId,
      `INSERT INTO chapters (id, story_id, chapter_number, title, status, scheduled_at, content) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, story_id, chapter_number, title, status, scheduled_at, content, view_count, created_at, updated_at`,
      [
        id,
        chapter.story_id,
        chapter.chapter_number,
        chapter.title,
        chapter.status,
        chapter.scheduled_at,
        normalizeChapterContent(chapter.content),
      ],
    );

    const created = result.results[0];
    if (!created) {
      throw new Error("Failed to create chapter");
    }

    return created;
  }

  async updateStory(
    databaseId: string,
    id: string,
    story: Pick<StoryRow, "title" | "slug" | "description" | "cover_url" | "status" | "scheduled_at" | "author" | "category" | "genres" | "tags" | "artist" | "translator" | "source" | "rank_score">,
  ): Promise<StoryRow | null> {
    const result = await this.query<{ results: StoryRow[] }>(
      databaseId,
      `UPDATE stories SET title = ?, slug = ?, description = ?, cover_url = ?, status = ?, scheduled_at = ?, author = ?, category = ?, genres = ?, tags = ?, artist = ?, translator = ?, source = ?, rank_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id, title, slug, description, cover_url, status, scheduled_at, view_count, author, category, genres, tags, artist, translator, source, rank_score, created_at, updated_at`,
      [
        story.title,
        story.slug,
        story.description,
        story.cover_url,
        story.status,
        story.scheduled_at,
        story.author,
        story.category,
        story.genres,
        story.tags,
        story.artist,
        story.translator,
        story.source,
        story.rank_score,
        id,
      ],
    );
    return result.results[0] ?? null;
  }

  async recordAuditLog(
    databaseId: string,
    entry: Pick<AuditLogRow, "actor_id" | "action" | "target_type" | "target_id" | "changes">,
  ): Promise<void> {
    await this.query(
      databaseId,
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, changes) VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), entry.actor_id, entry.action, entry.target_type, entry.target_id, entry.changes],
    );
  }

  async deleteStory(databaseId: string, id: string): Promise<boolean> {
    const existing = await this.getStory(databaseId, id);
    if (!existing) {
      return false;
    }

    await this.query(databaseId, `DELETE FROM stories WHERE id = ?`, [id]);
    return true;
  }
}

async function provisionTenant(env: Env, control: ControlPlaneRepository, name: string): Promise<{
  tenant: Omit<TenantRow, "api_key_hash" | "created_at" | "updated_at">;
  tenantKey: string;
}> {
  const tenantId = crypto.randomUUID();
  const tenantSlug = slugify(name);
  const databaseName = buildTenantDatabaseName(env, tenantSlug, tenantId);
  const tenantKey = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const apiKeyHash = await sha256Hex(tenantKey);
  const cloudflare = new CloudflareD1AdminClient(env);

  let provisioned: ProvisionedDatabase | null = null;

  try {
    // Step 1: Create the D1 database
    provisioned = await cloudflare.createDatabase(databaseName);

    // Step 2: Create tenant record in control plane with "provisioning" status
    await control.createTenant({
      id: tenantId,
      slug: tenantSlug,
      name,
      database_id: provisioned.id,
      database_name: provisioned.name,
      api_key_hash: apiKeyHash,
      status: "provisioning",
    });

    // Step 3: Bootstrap the database schema
    try {
      await cloudflare.bootstrapDatabase(provisioned.id);
    } catch (bootstrapError) {
      // If bootstrap fails, mark tenant as "failed_bootstrap" for recovery
      await control.updateTenantStatus(tenantId, "failed_bootstrap");
      throw new Error(`Schema bootstrap failed: ${(bootstrapError as Error).message}`);
    }

    // Step 4: Mark tenant as ready
    await control.markReady(tenantId);

    return {
      tenant: {
        id: tenantId,
        slug: tenantSlug,
        name,
        database_id: provisioned.id,
        database_name: provisioned.name,
        status: "ready",
      },
      tenantKey,
    };
  } catch (error) {
    // Mark as failed if not already marked as failed_bootstrap
    if (provisioned) {
      const existing = await control.getTenantById(tenantId);
      if (existing && existing.status === "provisioning") {
        await control.updateTenantStatus(tenantId, "failed");
      }
    }
    throw error;
  }
}

function getTenantSummary(tenant: TenantRow): Record<string, unknown> {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    databaseId: tenant.database_id,
    databaseName: tenant.database_name,
    status: tenant.status,
    createdAt: tenant.created_at,
    updatedAt: tenant.updated_at,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: jsonHeaders });
    }

    const url = new URL(request.url);
    const path = normalizePath(url.pathname);
    const control = new ControlPlaneRepository(env.CONTROL_DB);
    // Ensure control-plane schema exists in local dev fallback
    try {
      // eslint-disable-next-line no-await-in-loop
      await control.ensureSchema();
    } catch (e) {
      // ignore
    }
    const tenantClient = new TenantDatabaseClient(env);

    try {
      if (request.method === "GET" && path.length === 1 && path[0] === "health") {
        return jsonResponse({ ok: true });
      }

      if (path[0] === "tenants" && path.length === 1 && request.method === "POST") {
        const denied = requireAdmin(request, env);
        if (denied) {
          return denied;
        }

        const body = await readJsonBody<{ name: string }>(request);
        const tenantName = parseStringField(body.name, "name");
        const result = await provisionTenant(env, control, tenantName);

        return jsonResponse(
          {
            tenant: result.tenant,
            tenantKey: result.tenantKey,
            note: "Store tenantKey securely. It is returned only once.",
          },
          201,
        );
      }

      if (path[0] === "tenants" && path.length === 1 && request.method === "GET") {
        const denied = requireAdmin(request, env);
        if (denied) {
          return denied;
        }

        const tenants = await control.listTenants();
        return jsonResponse({ tenants: tenants.map(getTenantSummary) });
      }

      // Admin recovery endpoints
      if (path[0] === "admin" && path.length === 2 && path[1] === "failed-tenants" && request.method === "GET") {
        const denied = requireAdmin(request, env);
        if (denied) {
          return denied;
        }

        const failedTenants = await control.listFailedTenants();
        return jsonResponse({ failedTenants });
      }

      if (
        path[0] === "admin" &&
        path.length === 3 &&
        path[1] === "recover" &&
        request.method === "POST"
      ) {
        const denied = requireAdmin(request, env);
        if (denied) {
          return denied;
        }

        const tenantId = path[2];
        if (!tenantId) {
          return errorResponse("Tenant id is required", 400);
        }

        const tenant = await control.getTenantById(tenantId);
        if (!tenant) {
          return errorResponse("Tenant not found", 404);
        }

        if (tenant.status === "ready") {
          return jsonResponse({ success: true, message: "Tenant is already provisioned" });
        }

        if (tenant.status === "failed_bootstrap" && tenant.database_id) {
          // Try to bootstrap again
          try {
            const cloudflare = new CloudflareD1AdminClient(env);
            await cloudflare.bootstrapDatabase(tenant.database_id);
            await control.markReady(tenantId);
            return jsonResponse({ success: true, message: "Tenant recovered and marked ready" });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return errorResponse(`Recovery failed: ${message}`, 500);
          }
        }

        if (tenant.status === "provisioning") {
          return errorResponse("Provisioning is in progress, please wait", 409);
        }

        return errorResponse(`Cannot recover tenant in status: ${tenant.status}`, 400);
      }

      if (path[0] === "tenants" && path.length >= 2) {
        const tenantId = path[1];
        if (!tenantId) {
          return errorResponse("Tenant id is required", 400);
        }

        const tenant = await control.getTenantById(tenantId);
        if (!tenant) {
          return errorResponse("Tenant not found", 404);
        }

        const tenantDenied = await requireTenant(tenant, request);
        if (tenantDenied) {
          return tenantDenied;
        }

        if (path.length === 2 && request.method === "GET") {
          const authorization = await requireAnyRolePermission(request, env, ["stories:read"]);
          if (authorization.error) {
            return authorization.error;
          }

          return jsonResponse({ tenant: getTenantSummary(tenant) });
        }

        if (path.length === 3 && path[2] === "stories" && request.method === "GET") {
          const authorization = await requireAnyRolePermission(request, env, ["stories:read"]);
          if (authorization.error) {
            return authorization.error;
          }

          const stories = await tenantClient.listStories(tenant.database_id);
          return jsonResponse({ tenant: getTenantSummary(tenant), stories });
        }

        if (path.length === 3 && path[2] === "stories" && request.method === "POST") {
          const authorization = await requireAnyRolePermission(request, env, [
            "comics:create",
            "tables:crud:all",
          ]);
          if (authorization.error) {
            return authorization.error;
          }

          const body = await readJsonBody<{
            title: string;
            slug: string;
            description?: string;
            cover_url?: string;
            status?: string;
            scheduled_at?: string;
            author: string;
            category?: string | unknown[] | Record<string, unknown>;
            genres?: string | unknown[] | Record<string, unknown>;
            tags?: string | unknown[] | Record<string, unknown>;
            artist?: string;
            translator?: string;
            source?: string;
            rank_score?: number;
          }>(request);
          const title = parseStringField(body.title, "title");
          const slug = parseStringField(body.slug, "slug");
          const description = optionalStringField(body.description, "");
          const coverUrl = optionalStringField(body.cover_url, "");
          const status = normalizeLifecycleStatus(body.status, "draft");
          const scheduledAt = optionalStringOrNullField(body.scheduled_at);

          const author = parseStringField(body.author, "author");
          const category = optionalJsonStringField(body.category, "[]");
          const genres = normalizeJsonArrayField(body.genres, "[]");
          const tags = normalizeJsonArrayField(body.tags, "[]");
          const artist = optionalStringField(body.artist, "");
          const translator = optionalStringField(body.translator, "");
          const source = optionalStringField(body.source, "");
          const rankScore = optionalNumberField(body.rank_score, 0);

          const story = await tenantClient.createStory(tenant.database_id, {
            title,
            slug,
            description,
            cover_url: coverUrl,
            status,
            scheduled_at: scheduledAt,
            author,
            category,
            genres,
            tags,
            artist,
            translator,
            source,
            rank_score: rankScore,
          });
          await tenantClient.recordAuditLog(tenant.database_id, {
            actor_id: authorization.identity?.userId ?? null,
            action: "comics.create",
            target_type: "story",
            target_id: story.id,
            changes: JSON.stringify({ after: story }),
          });
          return jsonResponse({ tenant: getTenantSummary(tenant), story }, 201);
        }

        if (path.length === 4 && path[2] === "stories") {
          const storyId = path[3];
          if (!storyId) {
            return errorResponse("Story id is required", 400);
          }

          if (request.method === "GET") {
            const authorization = await requireAnyRolePermission(request, env, ["stories:read"]);
            if (authorization.error) {
              return authorization.error;
            }

            const story = await tenantClient.getStory(tenant.database_id, storyId);
            if (!story) {
              return errorResponse("Story not found", 404);
            }
            return jsonResponse({ tenant: getTenantSummary(tenant), story });
          }

          if (request.method === "PUT") {
            const authorization = await requireAnyRolePermission(request, env, [
              "comics:update",
              "tables:crud:all",
            ]);
            if (authorization.error) {
              return authorization.error;
            }

            const body = await readJsonBody<{
              title: string;
              slug: string;
              description?: string;
              cover_url?: string;
              status?: string;
              scheduled_at?: string;
              author: string;
              category?: string | unknown[] | Record<string, unknown>;
              genres?: string | unknown[] | Record<string, unknown>;
              tags?: string | unknown[] | Record<string, unknown>;
              artist?: string;
              translator?: string;
              source?: string;
              rank_score?: number;
            }>(request);
            const title = parseStringField(body.title, "title");
            const slug = parseStringField(body.slug, "slug");
            const description = optionalStringField(body.description, "");
            const coverUrl = optionalStringField(body.cover_url, "");
            const status = normalizeLifecycleStatus(body.status, "draft");
            const scheduledAt = optionalStringOrNullField(body.scheduled_at);

            const author = parseStringField(body.author, "author");
            const category = optionalJsonStringField(body.category, "[]");
            const genres = normalizeJsonArrayField(body.genres, "[]");
            const tags = normalizeJsonArrayField(body.tags, "[]");
            const artist = optionalStringField(body.artist, "");
            const translator = optionalStringField(body.translator, "");
            const source = optionalStringField(body.source, "");
            const rankScore = optionalNumberField(body.rank_score, 0);

            const story = await tenantClient.updateStory(tenant.database_id, storyId, {
              title,
              slug,
              description,
              cover_url: coverUrl,
              status,
              scheduled_at: scheduledAt,
              author,
              category,
              genres,
              tags,
              artist,
              translator,
              source,
              rank_score: rankScore,
            });
            if (!story) {
              return errorResponse("Story not found", 404);
            }
            await tenantClient.recordAuditLog(tenant.database_id, {
              actor_id: authorization.identity?.userId ?? null,
              action: "comics.update",
              target_type: "story",
              target_id: story.id,
              changes: JSON.stringify({ after: story }),
            });
            return jsonResponse({ tenant: getTenantSummary(tenant), story });
          }

          if (request.method === "DELETE") {
            const authorization = await requireAnyRolePermission(request, env, [
              "comics:delete",
              "tables:crud:all",
            ]);
            if (authorization.error) {
              return authorization.error;
            }

            const existingStory = await tenantClient.getStory(tenant.database_id, storyId);
            const deleted = await tenantClient.deleteStory(tenant.database_id, storyId);
            if (!deleted) {
              return errorResponse("Story not found", 404);
            }
            if (existingStory) {
              await tenantClient.recordAuditLog(tenant.database_id, {
                actor_id: authorization.identity?.userId ?? null,
                action: "comics.delete",
                target_type: "story",
                target_id: storyId,
                changes: JSON.stringify({ before: existingStory }),
              });
            }
            return jsonResponse({ tenant: getTenantSummary(tenant), deleted: true });
          }
        }

        if (path.length === 5 && path[2] === "stories" && path[4] === "chapters") {
          const storyId = path[3];
          if (!storyId) {
            return errorResponse("Story id is required", 400);
          }

          if (request.method === "GET") {
            const authorization = await requireAnyRolePermission(request, env, ["stories:read"]);
            if (authorization.error) {
              return authorization.error;
            }

            const chapters = await tenantClient.listChapters(tenant.database_id, storyId);
            return jsonResponse({ tenant: getTenantSummary(tenant), chapters });
          }

          if (request.method === "POST") {
            const authorization = await requireAnyRolePermission(request, env, [
              "chapters:insert",
              "chapters:create",
              "tables:crud:all",
            ]);
            if (authorization.error) {
              return authorization.error;
            }

            const body = await readJsonBody<{
              chapter_number: number;
              title: string;
              content?: unknown;
              status?: string;
              scheduled_at?: string;
            }>(request);

            const chapterNumber = Number(body.chapter_number);
            if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
              return errorResponse("chapter_number must be a positive integer", 400);
            }

            const title = parseStringField(body.title, "title");
            const content = normalizeChapterContent(body.content);
            if (!content) {
              return errorResponse("content is required", 400);
            }
            const status = normalizeLifecycleStatus(body.status, "draft");
            const scheduledAt = optionalStringOrNullField(body.scheduled_at);

            const chapter = await tenantClient.createChapter(tenant.database_id, {
              story_id: storyId,
              chapter_number: chapterNumber,
              title,
              status,
              scheduled_at: scheduledAt,
              content,
            });
            await tenantClient.recordAuditLog(tenant.database_id, {
              actor_id: authorization.identity?.userId ?? null,
              action: "chapters.create",
              target_type: "chapter",
              target_id: chapter.id,
              changes: JSON.stringify({ after: chapter }),
            });

            return jsonResponse({ tenant: getTenantSummary(tenant), chapter }, 201);
          }
        }
      }

      return errorResponse("Route not found", 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error";
      return errorResponse(message, 500);
    }
  },
};
