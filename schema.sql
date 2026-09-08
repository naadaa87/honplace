-- 혼곳 D1 스키마
-- Cloudflare 대시보드 > Workers & Pages > D1 > (데이터베이스) > Console 에 붙여넣고 실행하세요.

CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  category    TEXT NOT NULL,            -- today | story | review | ask
  nickname    TEXT NOT NULL,
  body        TEXT NOT NULL,
  space_id    TEXT,
  space_name  TEXT,
  metoo       INTEGER NOT NULL DEFAULT 0,
  thanks      INTEGER NOT NULL DEFAULT 0,
  going       INTEGER NOT NULL DEFAULT 0,
  comments    INTEGER NOT NULL DEFAULT 0,
  reports     INTEGER NOT NULL DEFAULT 0,
  hidden      INTEGER NOT NULL DEFAULT 0,
  ip_hash     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (hidden, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_cat ON posts (category, hidden, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_space ON posts (space_id, hidden, created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL,
  nickname    TEXT NOT NULL,
  body        TEXT NOT NULL,
  reports     INTEGER NOT NULL DEFAULT 0,
  hidden      INTEGER NOT NULL DEFAULT 0,
  ip_hash     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, hidden, created_at);

CREATE TABLE IF NOT EXISTS submissions (
  id          TEXT PRIMARY KEY,
  fix_id      TEXT,                     -- 기존 공간 수정 제안이면 해당 id
  name        TEXT NOT NULL,
  area        TEXT,
  cat         TEXT,
  solo        INTEGER,
  talk        INTEGER,
  note        TEXT NOT NULL,
  time        TEXT,
  status      TEXT NOT NULL DEFAULT 'new',   -- new | done | skip
  created_at  TEXT NOT NULL
);

-- 초기 글 (체험 모드의 seed-posts.json 과 같은 내용). 필요 없으면 이 아래는 지우고 실행해도 됩니다.
INSERT OR IGNORE INTO posts (id, category, nickname, body, space_id, space_name, metoo, thanks, going, comments, created_at) VALUES
('seed-01','today','창가 자리 하나','퇴근하고 집에 오니 8시. 아무 소리도 안 나서 티비 켜놓고 이거 씀.',NULL,NULL,41,3,0,2,'2026-09-05T20:12:00+09:00'),
('seed-02','review','을지로 이층','혼술바 처음 가봤는데 내가 생각한 혼술이 아니었음. 옆에 앉은 분이 계속 말 걸어서 첫 15분 진짜 어색. 근데 30분 지나니까 직업군인 하셨다는 분 얘기 듣는 게 재밌어서 두 시간 있다 옴. 연락처는 아무도 안 물어봤고 그게 제일 좋았음. 조용히 마시고 싶은 날은 안 맞을 듯.','jejuahop','제주아홉',12,8,15,1,'2026-09-04T23:48:00+09:00'),
('seed-03','ask','수요일의 고양이','서울 와서 1년 됐는데 회사 사람 말고는 아는 사람이 없어요. 근데 동호회 같은 건 좀 부담스럽고요. 말 안 해도 되는데 사람 소리는 나는 데 어디 없을까요. 성수 근처면 좋겠어요.',NULL,NULL,27,2,0,3,'2026-09-04T19:30:00+09:00'),
('seed-04','story','세 번째 잔','친구한테는 못 하는 말이 있어요. 걱정할 게 뻔해서. 근데 여기는 아무도 나를 모르니까 그냥 써도 될 것 같아서. 요즘 아침에 일어나는 게 제일 어려워요. 그것뿐이에요.',NULL,NULL,63,9,0,2,'2026-09-03T02:17:00+09:00'),
('seed-05','review','광화문 낮','평일 2시 씨네큐브. 관객 여섯 명이었고 다 혼자였음. 혼영 처음인데 이럴 거면 진작 올걸.','cinecube','씨네큐브 광화문',19,4,22,1,'2026-09-02T17:20:00+09:00'),
('seed-06','today','국밥 한 그릇','새벽 1시 국밥집. 옆자리 기사님이 깍두기 밀어주심. 그게 오늘 유일한 대화.','gukbap','국밥집',34,6,3,1,'2026-09-02T01:14:00+09:00'),
('seed-07','ask','잠 안 오는 목요일','지금 12시 반인데 집에 있기가 싫어요. 술은 별로고요. 이 시간에 갈 데가 있나요? 마포 근처.',NULL,NULL,15,1,0,2,'2026-09-01T00:31:00+09:00'),
('seed-08','review','일일권','클라이밍 처음 갔는데 혼자 온 사람이 대부분이라 어색한 게 없었음. 같은 문제 붙잡고 있던 분이 ''거기 왼발 먼저요'' 해준 게 전부인데 그게 좋았음. 손 아파서 한 시간 반 만에 나옴. 다음 주에 또 감.','climbing-gym','클라이밍 짐',8,3,17,0,'2026-08-31T21:05:00+09:00'),
('seed-09','story','느린 걸음','회사에서는 하루 종일 말을 하는데 집에 오면 한마디도 안 해요. 목소리를 안 쓰니까 어느 날은 내 목소리가 낯설더라고요. 그래서 요즘은 편의점에서 일부러 ''봉투 주세요'' 해요. 웃기죠.',NULL,NULL,52,5,0,1,'2026-08-30T22:48:00+09:00'),
('seed-10','review','통로 쪽','잠실 리타비터바. 바 자리밖에 없어서 혼자가 기본값. 위스키 시켰더니 음악을 바꿔주심. 말은 거의 안 했는데 두 시간이 갔음. 조용히 마시고 싶은 날 여기.','ritabitter-jamsil','리타비터바',6,2,11,0,'2026-08-29T23:55:00+09:00'),
('seed-11','today','벤치에 앉은','오늘은 안 나갔음. 그래도 여기 하나 쓰고 잠.',NULL,NULL,48,2,0,1,'2026-08-29T00:20:00+09:00'),
('seed-12','ask','처음 쓰는 사람','혼술바 가보고 싶은데 여자 혼자 가도 괜찮은지 모르겠어요. 헌팅하는 데라는 말도 있고. 다녀오신 분 있나요.',NULL,NULL,21,0,0,2,'2026-08-28T19:02:00+09:00');

INSERT OR IGNORE INTO comments (id, post_id, nickname, body, created_at) VALUES
('c-01-1','seed-01','국밥 한 그릇','저도요. 라디오 켜놓으면 좀 낫더라고요.','2026-09-05T20:40:00+09:00'),
('c-01-2','seed-01','밤에 걷는 사람','티비 소리로 버티는 저녁이 많죠. 그래도 여기 쓰셨네요.','2026-09-05T21:03:00+09:00'),
('c-02-1','seed-02','느린 걸음','첫 15분 어색한 거 다들 그렇대요. 저도 한 잔 시키고 그냥 앉아 있었어요.','2026-09-05T00:15:00+09:00'),
('c-03-1','seed-03','벤치에 앉은','서울숲 저녁에 가보세요. 혼자 앉아 있는 사람이 절반이라 하나도 안 튀어요.','2026-09-04T19:52:00+09:00'),
('c-03-2','seed-03','카운터 끝','성수 쪽 스탠딩 바요. 서서 마시니까 오래 안 있어도 되고 옆에 사람은 있어요.','2026-09-04T20:10:00+09:00'),
('c-03-3','seed-03','수요일의 고양이','둘 다 가볼게요. 고마워요.','2026-09-04T21:33:00+09:00'),
('c-04-1','seed-04','새벽 국밥','그것뿐인 게 아니라 그게 제일 큰 거죠. 쓰셨으니까 됐어요.','2026-09-03T02:41:00+09:00'),
('c-04-2','seed-04','창가 자리 하나','저도 요즘 그래요. 나만 그런 게 아니라는 거 알고 갑니다.','2026-09-03T08:05:00+09:00'),
('c-05-1','seed-05','통로 쪽','거긴 크레딧 끝날 때까지 다들 앉아 있어서 좋아요.','2026-09-02T18:02:00+09:00'),
('c-06-1','seed-06','밤에 걷는 사람','그 정도 대화가 딱 좋은 날이 있죠.','2026-09-02T01:30:00+09:00'),
('c-07-1','seed-07','탕에 10분','24시간 찜질방이요. 아무도 말 안 걸고 누워 있어도 돼요. 나오면 잠 와요.','2026-09-01T00:44:00+09:00'),
('c-07-2','seed-07','잠 안 오는 목요일','갔다 왔어요. 진짜 잠 오네요. 고마워요.','2026-09-01T03:12:00+09:00'),
('c-09-1','seed-09','창가 자리 하나','안 웃겨요. 저는 엘리베이터에서 ''몇 층 가세요'' 해요.','2026-08-30T23:10:00+09:00'),
('c-11-1','seed-11','세 번째 잔','안 나간 날도 괜찮아요.','2026-08-29T00:35:00+09:00'),
('c-12-1','seed-12','을지로 이층','매장마다 달라요. 입장 인원 제한하고 사장이 이상한 사람 바로 막아주는 데는 괜찮았고, 음악 크고 성비 안 맞는 데는 별로였어요. 후기 먼저 보고 가세요.','2026-08-28T19:40:00+09:00'),
('c-12-2','seed-12','카운터 끝','대화 목적이 아니면 북바나 재즈바가 더 편해요. 아무도 말 안 걸어요.','2026-08-28T20:15:00+09:00');
