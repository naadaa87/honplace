-- ─────────────────────────────────────────────
-- 002 · 호스트센터
-- 이미 schema.sql 로 테이블을 만든 데이터베이스에만 실행합니다.
-- (처음 만드는 경우에는 schema.sql 만 실행하면 됩니다. 이 파일은 필요 없습니다.)
--
-- 실행 방법: Cloudflare 대시보드 → D1 → honplace-db → Console 에 붙여 넣고 Execute
-- "duplicate column name" 오류가 나면 그 열은 이미 있는 것이니 그 줄만 빼고 다시 실행하세요.
-- ─────────────────────────────────────────────

ALTER TABLE comments ADD COLUMN is_host INTEGER NOT NULL DEFAULT 0;

ALTER TABLE hosts ADD COLUMN host_key TEXT;
ALTER TABLE hosts ADD COLUMN pub_title TEXT;
ALTER TABLE hosts ADD COLUMN pub_note TEXT;
ALTER TABLE hosts ADD COLUMN pub_seats TEXT;
ALTER TABLE hosts ADD COLUMN pub_hours TEXT;
ALTER TABLE hosts ADD COLUMN pub_link TEXT;
ALTER TABLE hosts ADD COLUMN pub_updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_hosts_key ON hosts (host_key);
