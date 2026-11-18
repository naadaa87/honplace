-- ─────────────────────────────────────────────
-- 003 · 방문 통계와 좋아요 (관리자 KPI)
-- 이미 schema.sql 로 테이블을 만든 데이터베이스에만 실행합니다.
-- (처음 만드는 경우에는 schema.sql 만 실행하면 됩니다.)
--
-- 실행 방법: Cloudflare 대시보드 → D1 → honplace-db → Console 에 붙여 넣고 Execute
-- 모두 CREATE ... IF NOT EXISTS 라서 두 번 실행해도 문제없습니다.
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- 방문 통계 (관리자 KPI)
-- 이름·연락처·IP 원문은 저장하지 않습니다. 방문자는 브라우저에서 무작위로 만든 id(vid)로만 구분합니다.
-- 날짜(day)와 시(hour)는 한국 시간 기준입니다.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pv (
  id         TEXT PRIMARY KEY,            -- 페이지 조회 한 번의 id (체류시간을 나중에 채우기 위해)
  day        TEXT NOT NULL,               -- YYYY-MM-DD (KST)
  hour       INTEGER NOT NULL,            -- 0~23 (KST)
  vid        TEXT NOT NULL,               -- 방문자: 브라우저에 저장된 무작위 id
  sid        TEXT NOT NULL,               -- 방문(세션): 30분 동안 움직임이 없으면 새로 시작
  path       TEXT NOT NULL,               -- /place/okdongsik 같은 경로 (쿼리 제외)
  kind       TEXT NOT NULL,               -- home | place | cat | area | guide | magazine | test | board | spaces | host | submit | etc
  space_id   TEXT,                        -- 플레이스 페이지면 그 id
  ref_type   TEXT,                        -- direct | search | social | ref | campaign | internal
  ref_host   TEXT,                        -- naver, google, instagram.com …
  kw         TEXT,                        -- 검색어(전달된 경우만) 또는 캠페인 이름
  device     TEXT,                        -- mobile | tablet | desktop
  is_new     INTEGER NOT NULL DEFAULT 0,  -- 이 브라우저의 첫 방문이면 1
  entry      INTEGER NOT NULL DEFAULT 0,  -- 방문의 첫 페이지면 1
  dwell_ms   INTEGER NOT NULL DEFAULT 0,  -- 화면을 실제로 보고 있던 시간
  created_at TEXT NOT NULL
);
-- 색인은 날짜 하나만 둡니다 (D1 은 색인 갱신도 쓰기 횟수로 셈)
CREATE INDEX IF NOT EXISTS idx_pv_day ON pv (day);

-- 클릭과 행동: 지도 버튼, 외부 링크, 좋아요, 검색, 테스트 결과, 글쓰기 등
CREATE TABLE IF NOT EXISTS ev (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  day        TEXT NOT NULL,
  hour       INTEGER NOT NULL,
  vid        TEXT NOT NULL,
  sid        TEXT,
  path       TEXT,
  space_id   TEXT,
  type       TEXT NOT NULL,               -- map | out | mail | like | unlike | share | search | filter | test_start | test_result | post | host_apply | submit | cta
  label      TEXT,                        -- naver / google / 검색어 / 결과 유형 등
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ev_day ON ev (day, type);

-- 플레이스 '가고 싶어요' (좋아요)
CREATE TABLE IF NOT EXISTS likes (
  space_id   TEXT NOT NULL,
  vid        TEXT NOT NULL,
  ip_hash    TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (space_id, vid)
);
CREATE INDEX IF NOT EXISTS idx_likes_created ON likes (created_at);
CREATE INDEX IF NOT EXISTS idx_likes_ip ON likes (ip_hash, created_at);
