# CMS Implementation Blueprint

Date: 2026-05-11

## 1) Updated D1 Schema

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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'archived')),
  scheduled_at TEXT,
  genres TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  artist TEXT NOT NULL DEFAULT '',
  translator TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  rank_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comic_id INTEGER NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL CHECK (chapter_number > 0),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'archived')),
  scheduled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (comic_id, chapter_number)
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  order_index INTEGER NOT NULL,
  r2_image_key TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chapter_id, page_number),
  UNIQUE (chapter_id, order_index)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'pending', 'flagged', 'hidden')),
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

CREATE TABLE IF NOT EXISTS draft_buffers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  draft_type TEXT NOT NULL CHECK (draft_type IN ('comic', 'chapter', 'page', 'comment')),
  target_id INTEGER,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  changes TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comics_status ON comics(status);
CREATE INDEX IF NOT EXISTS idx_comics_scheduled_at ON comics(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_comics_rank_score ON comics(rank_score DESC);
CREATE INDEX IF NOT EXISTS idx_comics_updated_at ON comics(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chapters_comic_id ON chapters(comic_id);
CREATE INDEX IF NOT EXISTS idx_chapters_status ON chapters(status);
CREATE INDEX IF NOT EXISTS idx_chapters_scheduled_at ON chapters(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_pages_chapter_id ON pages(chapter_id);
CREATE INDEX IF NOT EXISTS idx_pages_order_index ON pages(chapter_id, order_index);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_chapter_id ON comments(chapter_id);
CREATE INDEX IF NOT EXISTS idx_comments_moderation_status ON comments(moderation_status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_timestamp ON audit_logs(actor_id, timestamp DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS comics_fts USING fts5(
  title,
  tags,
  genres,
  artist,
  translator,
  source,
  content='comics',
  content_rowid='id'
);

INSERT OR IGNORE INTO roles (name) VALUES
  ('superadmin'),
  ('admin'),
  ('employee'),
  ('user');

CREATE TRIGGER IF NOT EXISTS trg_comics_touch_updated_at
AFTER UPDATE ON comics
FOR EACH ROW
BEGIN
  UPDATE comics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_chapters_touch_updated_at
AFTER UPDATE ON chapters
FOR EACH ROW
BEGIN
  UPDATE chapters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_pages_touch_updated_at
AFTER UPDATE ON pages
FOR EACH ROW
BEGIN
  UPDATE pages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_comments_touch_updated_at
AFTER UPDATE ON comments
FOR EACH ROW
BEGIN
  UPDATE comments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_reading_history_touch_updated_at
AFTER UPDATE OF last_chapter_id ON reading_history
FOR EACH ROW
BEGIN
  UPDATE reading_history
  SET updated_at = CURRENT_TIMESTAMP
  WHERE user_id = NEW.user_id AND comic_id = NEW.comic_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_chapters_cleanup_children
AFTER DELETE ON chapters
FOR EACH ROW
BEGIN
  DELETE FROM pages WHERE chapter_id = OLD.id;
  DELETE FROM comments WHERE chapter_id = OLD.id;
END;
```

## 2) Smart Upload Pseudocode

```ts
async function smartUpload(request, env, ctx) {
  const actor = await resolveActor(request, env);
  requirePermission(actor, 'chapter:create');

  const form = await request.formData();
  const files = extractFiles(form).sort((left, right) => compareFilenameOrder(left.name, right.name));

  for (const [index, file] of files.entries()) {
    const originalBytes = await file.arrayBuffer();
    const webpBlob = await convertToWebp(originalBytes, file.type);
    const compressedBlob = await compressToLimit(webpBlob, 2 * 1024 * 1024);
    const r2Key = buildR2Key(file.name, index);

    await env.R2.put(r2Key, compressedBlob, {
      httpMetadata: { contentType: 'image/webp' },
      customMetadata: { order_index: String(index) },
    });

    await env.DB.prepare(
      'INSERT INTO pages (chapter_id, page_number, order_index, r2_image_key) VALUES (?1, ?2, ?3, ?4)'
    ).bind(form.get('chapter_id'), index + 1, index, r2Key).run();

    ctx.waitUntil(recordAudit(env, actor.id, 'page.upload', 'page', index + 1, JSON.stringify({ r2Key })));
  }
}

async function purgeCache(env, urls) {
  await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: urls }),
  });
}
```

## 3) Delivery Rules

- Free assets are served from public URLs with long cache headers.
- Premium assets are signed by the Worker and validated before R2 access.
- Cache purge is mandatory when an image is replaced.
- Audit writes must run in the background path, not inline with the response body.
