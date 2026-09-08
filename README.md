# 혼곳 — 배포 안내

혼곳은 ‘혼자 가기 좋은 곳’을 줄인 말입니다. 혼자 가도 어색하지 않은 곳을 모으고, 이름 없이 이야기를 남길 수 있는 서비스입니다.
빌드 과정이 없는 정적 사이트라서 이 폴더를 그대로 GitHub에 올리고 Cloudflare Pages에 연결하면 바로 열립니다.
게시판은 데이터베이스(D1)를 붙이기 전까지 **체험 모드**로 동작하고, 붙이는 순간 실제 게시판이 됩니다.

---

## 1. GitHub에 올리기

1. GitHub에서 새 저장소(Repository)를 만듭니다. 이름은 `hongot` 정도면 됩니다.
2. 이 폴더 안의 파일 **전부**를 저장소에 올립니다. 브라우저에서 "Add file → Upload files"로 끌어다 놓으면 됩니다.
   - `functions` 폴더와 `_headers`, `schema.sql` 도 함께 올라가야 합니다.
   - 폴더 구조가 그대로 유지되어야 합니다. `index.html`이 저장소 최상단에 있어야 합니다.

## 2. Cloudflare Pages 연결

1. Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. 위에서 만든 저장소를 고릅니다.
3. 빌드 설정:
   - Framework preset: **None**
   - Build command: (비워 둠)
   - Build output directory: **/** (슬래시 하나)
4. **Save and Deploy**. 1~2분 뒤 `https://hongot.pages.dev` 같은 주소가 생깁니다.

여기까지 하면 사이트는 열리고, 곳 찾기와 혼자 하는 법은 그대로 동작합니다. 게시판은 체험 모드입니다(글이 이 기기에만 저장됨).

## 3. 데이터베이스(D1) 만들고 연결하기 — 게시판을 실제로 켜는 단계

1. 대시보드 → **Workers & Pages** → **D1 SQL Database** → **Create database**. 이름은 `hongot-db`.
2. 만들어진 데이터베이스를 열고 **Console** 탭으로 갑니다.
3. 저장소에 있는 `schema.sql` 파일 내용을 전부 복사해서 붙여 넣고 **Execute**.
   (초기 글 12개가 함께 들어갑니다. 빈 게시판으로 시작하고 싶으면 `-- 초기 글` 아래 부분을 지우고 실행하세요.)
4. Pages 프로젝트로 돌아가서 **Settings → Functions → D1 database bindings** → **Add binding**.
   - Variable name: **DB** (대문자, 정확히 이 이름)
   - D1 database: `hongot-db`
5. 같은 화면의 **Environment variables**에 두 개를 추가합니다.
   - `ADMIN_KEY` — 운영자용 비밀 문자열. 아무 긴 문자열이나 됩니다.
   - `IP_SALT` — 선택. 아무 문자열. 도배 방지용 IP 해시에 섞는 값입니다.
6. **Deployments** 탭에서 최신 배포의 **Retry deployment**(재배포)를 누릅니다.

재배포가 끝나면 게시판 위의 노란 "체험 모드" 안내가 사라지고, 글이 실제로 저장됩니다.

## 4. 운영자가 할 수 있는 것

브라우저 주소창에 아래를 입력합니다. `KEY` 자리에 위에서 만든 `ADMIN_KEY`를 넣습니다.

- 신고가 쌓인 글 보기: `https://(내 주소)/api/admin?key=KEY`
- 곳 제보·수정 제안 보기: `https://(내 주소)/api/admin?key=KEY&what=submissions`

신고가 3건 쌓이면 글은 자동으로 숨겨집니다. 숨긴 글을 완전히 지우거나 되살리는 것은 POST 요청이 필요해서, 필요할 때 아래 방법을 씁니다.
(브라우저 개발자 도구 Console에 붙여 넣기)

```js
fetch('/api/admin?key=KEY', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'delete', id: '글ID' }) }).then(r => r.json()).then(console.log)
// action: 'hide' 숨기기 / 'unhide' 되살리기 / 'delete' 삭제
// 제보 처리: { action: 'submission', id: '제보ID', status: 'done' }  (또는 'skip')
```

---

## 오픈 전에 바꿔야 하는 것

| 항목 | 위치 |
|---|---|
| 푸터의 운영사·대표·사업자번호·문의 메일 | 모든 `.html` 파일 맨 아래 `<div class="legal">` (10개 파일 모두) |
| 개인정보처리방침의 문의 메일 | `privacy.html` |
| 약관·방침 시행일과 "초안" 문구 | `terms.html`, `privacy.html` 상단 |
| 사이트 주소 | `sitemap.xml`, `robots.txt`, 각 html의 `og:url`·`og:image` (`hongot.pages.dev` → 실제 도메인) |

## 콘텐츠 고치는 법 (코드 지식 없이)

- **곳 추가·수정**: `data/spaces.json` 을 열어 항목을 복사해 붙이고 내용을 바꿉니다.
  - `kind`: `place`(실제 장소) 또는 `type`(유형 — "타치노미" 처럼 특정 가게가 아닌 형태)
  - `cat`: honsul / honbap / cafe / culture / move / rest / learn / social
  - `solo`: 1~5 (혼자여도 눈에 안 띄는 정도) / `talk`: 0 조용히, 1 원하면 한마디, 2 이야기 중심
  - `tier`: 0 거의 무료, 1 1~2만 원, 2 3만 원 이상 / `time`: `day` `evening` `night` 중 해당하는 것
  - `mapq`: 네이버 지도 검색어
- **가이드 글 추가**: `data/guides.json`. `blocks`에 `h`(소제목) `p`(문단) `ul`(목록) `quote`(인용)를 순서대로 넣습니다.
- **초기 게시글**: 체험 모드는 `data/seed-posts.json`, 실제 DB는 `schema.sql`의 INSERT 부분.

> 초기 등록된 22곳은 공개된 자료를 바탕으로 정리한 것입니다. 개별 가게(마심, 리타비터바, 제주아홉, 고도 등)는 운영 시간과 규칙이 바뀔 수 있으니 오픈 전에 한 번 확인하고, 틀린 곳은 `spaces.json`에서 바로 고치면 됩니다.

## 폴더 구조

```
index.html          홈 (문장으로 오늘 갈 곳 고르기)
spaces.html         곳 찾기 (필터·검색)
space.html?id=      곳 상세 + 익명 후기
guide.html?id=      혼자 하는 법 / 혼자에 대하여
board.html?cat= / ?id=   이름 없는 이야기 (익명 게시판)
about.html          소개 · 게시판 규칙 (#rules)
submit.html?fix=    곳 알려 주기 · 정보 수정 제안
terms.html / privacy.html / 404.html
assets/             css, js, 아이콘, OG 이미지
data/               spaces.json, guides.json, seed-posts.json
functions/api/      Cloudflare Pages Functions (게시판·제보·운영 API)
schema.sql          D1 테이블 + 초기 글
_headers            보안·캐시 헤더
```

## 브랜드 · 디자인 메모

**이름** 혼곳 = 혼자 + 곳. 풀어 쓰면 ‘혼자 가기 좋은 곳’. 영문 표기 hongot.
**한 줄 문구** 오늘은 혼자 가기 좋은 곳으로.

**모티프** 한 줄에 늘어선 곳들, 그중 하나에 불이 켜져 있는 그림 하나로 통일했습니다.
- 로고 마크: 바닥선 위에 불 켜진 곳 하나, 아직 불 안 켜진 곳 하나
- 홈 히어로: 같은 그림을 화면 폭으로 늘린 것. 불 켜진 자리는 요일마다 바뀝니다
- 혼자 지수: 같은 형태의 작은 불빛 다섯 개
- 페이지는 낮(흰 배경)에서 시작해 밤(어두운 푸터)으로 끝납니다

**색** 흰색 #FFFFFF, 연한 회색 #F3F3F0, 글자 #1C1C21. 포인트는 램프 노랑 #F3B640 하나, 글자용 꿀색 #9A6512.

**서체** 고운바탕(제목·사용자의 문장·게시글) + 프리텐다드(메뉴·표·버튼). CDN에서 불러오므로 설치 불필요.

**용어** 곳 찾기 / 혼자 지수 / 대화 온도 / 이름 없는 이야기. 사이트 전체에서 ‘공간’ 대신 ‘곳’을 씁니다.

**구조 원칙**
- 홈의 추천은 버튼 나열이 아니라 사용자의 문장입니다. 빈칸을 눌러 채우면 아래에 곳이 나오고, 시간 칸은 접속 시각으로 미리 채워집니다
- 게시글은 편지처럼 본문이 먼저, 끝에 "— 이름"으로 서명합니다
- 목록은 카드가 아니라 표와 목차(점선 리더)입니다
