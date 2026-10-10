-- Additive, idempotent migration. Rolling back the application leaves anonymous counters intact.
CREATE TABLE IF NOT EXISTS marketing_pageviews (
  day DATE NOT NULL,
  path TEXT NOT NULL CHECK (length(path) <= 200),
  channel TEXT NOT NULL CHECK (channel IN ('direct', 'organic_search', 'social', 'email', 'referral', 'unknown')),
  views BIGINT NOT NULL CHECK (views > 0),
  PRIMARY KEY (day, path, channel)
);
