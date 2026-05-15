#!/usr/bin/env node
const https = require('https');
const crypto = require('crypto');
(async function main(){
  try{
    const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
    const acc = process.env.CF_ACCOUNT_ID;
    if(!token || !acc){
      console.error('MISSING_ENV', !token ? 'NO_TOKEN' : '', !acc ? 'NO_ACCOUNT_ID' : '');
      process.exit(1);
    }

    const post = (path, body) => new Promise((resolve, reject) => {
      const d = JSON.stringify(body);
      const opts = {
        hostname: 'api.cloudflare.com',
        path: '/client/v4/' + path,
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(d),
        },
      };
      const req = https.request(opts, res => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => {
          try { resolve(JSON.parse(b)); } catch (e) { resolve(b); }
        });
      });
      req.on('error', e => reject(e));
      req.write(d);
      req.end();
    });

    const name = 'tenant-provision-' + Date.now();
    console.log('Creating D1 database ->', name);
    const created = await post(`accounts/${acc}/d1/database`, { name });
    if(!created || !created.result){
      console.error('CREATE_FAILED', JSON.stringify(created, null, 2));
      process.exit(1);
    }
    const dbId = created.result.uuid || created.result.id || created.result.database_id || created.result.uuid;
    console.log('DB_CREATED', dbId, created.result.name);

    const statements = [
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
      "CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, changes TEXT NOT NULL, timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_type, target_id)",
      "CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_timestamp ON audit_logs (actor_id, timestamp DESC)",
      "CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name)",
      "CREATE TABLE IF NOT EXISTS authors (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, bio TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_authors_name ON authors (name)",
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE, role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'employee', 'user')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)",
      "CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)",
      "CREATE TABLE IF NOT EXISTS chapter_views (id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL REFERENCES chapters (id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE, viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_chapter_views_chapter_id ON chapter_views (chapter_id)",
      "CREATE INDEX IF NOT EXISTS idx_chapter_views_user_id ON chapter_views (user_id)",
      "CREATE INDEX IF NOT EXISTS idx_chapter_views_viewed_at ON chapter_views (viewed_at DESC)",
      "CREATE TABLE IF NOT EXISTS story_likes (id TEXT PRIMARY KEY, story_id TEXT NOT NULL REFERENCES stories (id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_story_likes_story_id ON story_likes (story_id)",
      "CREATE INDEX IF NOT EXISTS idx_story_likes_user_id ON story_likes (user_id)",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_story_likes_unique ON story_likes (story_id, user_id)",
      "CREATE TRIGGER IF NOT EXISTS trg_chapters_sync_story_views_after_insert AFTER INSERT ON chapters BEGIN UPDATE stories SET view_count = (SELECT COALESCE(SUM(view_count), 0) FROM chapters WHERE story_id = NEW.story_id), updated_at = CURRENT_TIMESTAMP WHERE id = NEW.story_id; END",
      "CREATE TRIGGER IF NOT EXISTS trg_chapters_sync_story_views_after_update AFTER UPDATE OF view_count, story_id ON chapters BEGIN UPDATE stories SET view_count = (SELECT COALESCE(SUM(view_count), 0) FROM chapters WHERE story_id = NEW.story_id), updated_at = CURRENT_TIMESTAMP WHERE id = NEW.story_id; UPDATE stories SET view_count = (SELECT COALESCE(SUM(view_count), 0) FROM chapters WHERE story_id = OLD.story_id), updated_at = CURRENT_TIMESTAMP WHERE id = OLD.story_id AND OLD.story_id <> NEW.story_id; END",
      "CREATE TRIGGER IF NOT EXISTS trg_chapters_sync_story_views_after_delete AFTER DELETE ON chapters BEGIN UPDATE stories SET view_count = (SELECT COALESCE(SUM(view_count), 0) FROM chapters WHERE story_id = OLD.story_id), updated_at = CURRENT_TIMESTAMP WHERE id = OLD.story_id; END",
    ];

    for(const s of statements){
      const res = await post(`accounts/${acc}/d1/database/${dbId}/query`, { sql: s, params: [] });
      if(!res || res.success === false){
        console.error('BOOTSTRAP_FAILED', JSON.stringify(res, null, 2));
        process.exit(1);
      }
      console.log('BOOTSTRAP_OK');
    }

    const tenantKey = (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')).slice(0,64);
    const hash = crypto.createHash('sha256').update(tenantKey).digest('hex');

    console.log('TENANT_KEY', tenantKey);
    console.log('TENANT_KEY_HASH', hash);
    console.log(JSON.stringify({ databaseId: dbId, databaseName: name, tenantKey, tenantKeyHash: hash }, null, 2));
    process.exit(0);
  }catch(e){
    console.error(e);
    process.exit(1);
  }
})();