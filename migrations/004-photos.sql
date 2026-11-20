-- ─────────────────────────────────────────────
-- 004 · 지점 사진
-- 이미 schema.sql 로 테이블을 만든 데이터베이스에만 실행합니다.
-- (처음 만드는 경우에는 schema.sql 만 실행하면 됩니다.)
--
-- 실행 방법: Cloudflare 대시보드 → D1 → honplace-db → Console 에 붙여 넣고 Execute
-- CREATE ... IF NOT EXISTS 라서 두 번 실행해도 문제없습니다.
-- ─────────────────────────────────────────────
-- ─────────────────────────────────────────────
-- 지점 사진 (관리자·호스트가 올린 것)
-- kind='upload' : 브라우저에서 줄인 사진을 base64 글자로 저장 (본문 data, 작은 그림 thumb)
-- kind='url'    : 바깥 주소를 그대로 씀 (위키미디어 공용, 공공누리 등 자유 이용 사진)
-- 목록을 읽을 때는 data·thumb 열을 빼고 읽습니다.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photos (
  id         TEXT PRIMARY KEY,
  space_id   TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'upload',
  url        TEXT,
  thumb_url  TEXT,
  data       TEXT,
  thumb      TEXT,
  mime       TEXT,
  w          INTEGER,
  h          INTEGER,
  alt        TEXT,                        -- 사진 설명
  credit     TEXT,                        -- 출처 표기 (찍은 사람·제공처)
  license    TEXT,                        -- CC BY-SA 4.0, 공공누리 1유형 등
  source     TEXT,                        -- 출처 페이지 주소
  by         TEXT NOT NULL DEFAULT 'admin',   -- admin | host
  host_id    TEXT,
  sort       INTEGER NOT NULL DEFAULT 100,    -- 작을수록 앞. 가장 앞이 대표 사진
  hidden     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photos_space ON photos (space_id, hidden, sort);
