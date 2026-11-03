-- 2yolks MCP + blog schema.
-- mcp_audit records every authenticated MCP write (and auth denials) so agent
-- actions are attributable. Blog posts follow the same provenance rules as
-- recipes: draft-first, publish only through the MCP, never deleted (only
-- unpublished). Blog rows have no source table: blog content is original
-- editorial, recorded with its author.

CREATE TABLE mcp_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL DEFAULT (datetime('now')),
  actor       TEXT NOT NULL,              -- named key or caller header
  role        TEXT NOT NULL,              -- viewer | editor | admin
  tool        TEXT NOT NULL,              -- tool name or 'auth'
  entity_id   TEXT,                       -- recipe/blog/source id when known
  details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_mcp_audit_ts ON mcp_audit(ts);

CREATE TABLE blog_posts (
  id         TEXT PRIMARY KEY,
  author     TEXT NOT NULL,               -- byline, e.g. agent or person name
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE blog_post_locales (
  post_id TEXT NOT NULL REFERENCES blog_posts(id),
  country TEXT NOT NULL,                  -- country prefix, e.g. 'us'
  lang    TEXT NOT NULL,                  -- language segment, e.g. 'en'
  title   TEXT NOT NULL,
  slug    TEXT NOT NULL,                  -- slug within (country, lang)
  excerpt TEXT,
  body    TEXT NOT NULL,                  -- Markdown body
  status  TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'rejected')),
  PRIMARY KEY (country, lang, slug)
);

CREATE INDEX idx_blog_post_locales_post ON blog_post_locales(post_id);
CREATE INDEX idx_blog_post_locales_country ON blog_post_locales(country, lang, status);
