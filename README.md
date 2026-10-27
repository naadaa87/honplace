# 혼플 — 운영 안내

혼플은 ‘혼자 가기 좋은 플레이스’를 줄인 말입니다. 혼자 가도 어색하지 않은 곳을 모으고, 이름 없이 이야기를 남길 수 있는 서비스입니다.

- 저장소: https://github.com/naadaa87/honplace
- 사이트: https://honplace.pages.dev
- 관리자: https://honplace.pages.dev/admin

---

## 1. 이 저장소의 구조

페이지는 **빌드로 생성**됩니다. `data/` 안의 JSON을 고치고 빌드를 돌리면 HTML이 다시 만들어집니다.

```
data/spaces.json       플레이스 데이터 (이것만 고치면 됩니다)
data/guides.json       '혼자 하는 법' 글
data/magazine.json     매거진 글
tools/build.mjs        생성기
tools/shell.mjs        공통 <head>·헤더·푸터 템플릿

index.html             홈
spaces.html            플레이스 전체 목록
place/<id>.html        플레이스 상세 (검색 노출의 핵심)
c/<분류>.html           분류별 모음
area/<지역>.html        동네별 모음
guide/index.html       혼자 하는 법 목차
guide/<id>.html        개별 안내 글
magazine/index.html    매거진 목차
magazine/<id>.html     개별 매거진 글
board.html             익명 게시판
admin.html             관리자
sitemap.xml / rss.xml / robots.txt / _redirects / _headers
functions/api/         Cloudflare Pages Functions (게시판·제보·관리 API)
schema.sql             D1 테이블 + 초기 글
```

## 2. 플레이스를 추가하거나 고치는 법

**방법 A — 관리자 화면 (추천)**

1. `/admin` 에 접속해 ADMIN_KEY 로 들어갑니다.
2. **플레이스** 탭의 편집기에서 내용을 고칩니다.
3. **검사**를 눌러 형식 오류가 없는지 확인합니다.
4. **파일 내려받기**로 `spaces.json` 을 받습니다.
5. 깃허브의 `data/spaces.json` 에 덮어쓰고 커밋합니다.
6. 아래 3번 빌드를 한 번 돌립니다.

**방법 B — 깃허브에서 직접**

`data/spaces.json` 을 열어 항목을 복사해 붙이고 내용을 바꿉니다.

| 항목 | 설명 |
|---|---|
| `id` | 영문 소문자·숫자·하이픈만. 페이지 주소가 됩니다 (`/place/<id>`) |
| `kind` | `place`(실제 장소) 또는 `type`(타치노미처럼 형태를 소개하는 항목) |
| `cat` | honsul / honbap / cafe / culture / move / rest / learn / social |
| `area` | 시·구·동 수준. 동네별 페이지 분류에 쓰입니다 |
| `addr` | 전체 주소 (없으면 빈 문자열) |
| `solo` | 1~5. 혼자여도 눈에 안 띄는 정도 |
| `talk` | 0 조용히 / 1 원하면 한마디 / 2 이야기가 중심 |
| `price` | 표시용 문구 (예: "1~2만 원") |
| `tier` | 0 거의 무료 / 1 1~2만 원 / 2 3만 원 이상. 홈 예산 필터에 쓰입니다 |
| `time` | `day` `evening` `night` 중 해당하는 것들 |
| `tags` | 짧은 키워드 3~5개 |
| `intro` `culture` `first` | 어떤 곳인가 / 분위기와 문화 / 처음 가면 |
| `notes` | 주의사항 배열 |
| `mapq` | 지도 검색어. 보통 "이름 + 동네" |

## 3. 빌드 — 페이지를 다시 만들기

데이터를 고친 뒤에는 반드시 한 번 실행해야 새 페이지가 만들어집니다.

```bash
node tools/build.mjs
```

Node가 설치된 환경이면 어디서든 됩니다. 실행하면 `생성 완료 — N개 파일` 이 찍히고, 바뀐 HTML을 커밋하면 Cloudflare Pages가 1~2분 뒤 자동 배포합니다.

> 빌드를 돌릴 수 없는 환경이라면, 데이터만 고쳐서 커밋해도 목록·필터·검색에는 반영됩니다. 다만 새 플레이스의 전용 페이지(`/place/<id>`)는 빌드를 해야 생깁니다.

## 4. 데이터베이스(D1) — 게시판을 실제로 켜기

1. Cloudflare 대시보드 → **Workers & Pages** → **D1** → **Create database**. 이름은 `honplace-db`.
2. **Console** 탭에서 `schema.sql` 내용을 붙여 넣고 **Execute**.
3. Pages 프로젝트 → **Settings → Functions → D1 database bindings** → Variable name **DB**, 데이터베이스 `honplace-db`.
4. 같은 화면 **Environment variables** 에 추가:
   - `ADMIN_KEY` — 관리자 접속 키. 길게 만드세요.
   - `IP_SALT` — 선택. 도배 방지용 IP 해시에 섞는 값.
5. **Deployments** 탭에서 최신 배포 **Retry deployment**.

**확인**: `https://honplace.pages.dev/api/health` 에서 `{"ready":true}` 가 나오면 연결된 것입니다.

## 5. 관리자 화면

`/admin` 에 접속해 ADMIN_KEY 를 입력합니다. 키는 그 브라우저에만 저장됩니다.

| 탭 | 할 수 있는 것 |
|---|---|
| 대시보드 | 글 수, 오늘 올라온 글, 신고·제보 대기, 최근 2주 추이, 분류별·플레이스별 분포 |
| 글 관리 | 검색·필터·페이징, 숨기기·복구·삭제, 답글 확인과 삭제, 여러 건 일괄 처리 |
| 신고 | 신고가 쌓인 글만 모아 보기 (신고 3건이면 자동으로 숨겨집니다) |
| 제보 | 방문자 제보와 수정 제안, 상태 변경, 등록용 JSON 조각 복사 |
| 플레이스 | 등록 현황, spaces.json 편집·검사·내려받기 |
| 도움말 | 운영에서 자주 하는 일 정리 |

삭제는 되돌릴 수 없습니다. 애매하면 숨기기를 쓰세요.

## 6. 검색 노출(SEO) 설정

구조는 이미 들어가 있습니다. 남은 것은 등록 작업입니다.

**네이버 — 소유 확인 태그 반영 완료**

`tools/shell.mjs` 에 아래 태그가 들어가 있고, 빌드된 모든 페이지의 `<head>` 에 출력됩니다.

```html
<meta name="naver-site-verification" content="0efe77b67518e410ae0edd3bf246b4ef150bd949">
```

서치어드바이저에서 **소유확인** 버튼을 누르면 됩니다. 단, 서치어드바이저에 등록된 주소가 `http://honplace.com` 이므로 **그 도메인이 이 사이트를 가리키고 있어야** 확인이 통과합니다. 아래 ‘도메인 연결’을 먼저 확인하세요.

**구글**

서치콘솔에 등록하고 받은 코드를 `tools/shell.mjs` 의 주석 처리된 `google-site-verification` 줄에 넣고 주석을 푼 뒤 빌드합니다.

**사이트맵 제출**

두 곳 모두 사이트맵을 제출합니다. 네이버는 RSS도 함께 받습니다.

- `/sitemap.xml`
- `/rss.xml` (네이버)

주소는 아래 ‘도메인 연결’에서 정한 정식 주소를 기준으로 제출하세요.

### 도메인 연결 (honplace.com)

현재 사이트의 정식 주소는 `honplace.pages.dev` 이고, `tools/shell.mjs` 의 `SITE` 상수가 그 값을 씁니다. `honplace.com` 을 쓰려면 순서가 있습니다.

1. Cloudflare Pages 프로젝트 → **Custom domains** → `honplace.com` 추가, DNS 연결.
2. 브라우저에서 `https://honplace.com` 이 실제로 열리는지 확인합니다.
3. 그다음에 `tools/shell.mjs` 의 `SITE` 를 `'https://honplace.com'` 으로 바꾸고 `node tools/build.mjs` 를 실행해 커밋합니다.
4. 서치어드바이저·서치콘솔에 사이트맵을 다시 제출합니다.

> 2번을 건너뛰고 3번을 먼저 하면 모든 페이지의 canonical 이 열리지 않는 주소를 가리키게 되어 검색 노출에 손해가 큽니다. 반드시 연결을 확인한 뒤에 바꾸세요.

이미 적용되어 있는 것:

- 페이지마다 고유한 `<title>`, `description`, `canonical`
- 구조화 데이터 — Organization, WebSite, ItemList, LocalBusiness, Article, FAQPage, BreadcrumbList
- 빵부스러기 내비게이션과 촘촘한 내부 링크 (플레이스 ↔ 분류 ↔ 동네 ↔ 매거진)
- 목록을 빌드 시점에 HTML로 그려 두어 크롤러가 자바스크립트 없이 읽을 수 있음
- sitemap.xml 자동 생성, robots.txt (네이버 Yeti·구글·다음 명시), RSS

## 7. 오픈 전에 바꿔야 하는 것

| 항목 | 위치 |
|---|---|
| 푸터의 운영사·대표·사업자번호·문의 메일 | `tools/shell.mjs` 의 `legal` 부분 → 빌드 |
| 개인정보처리방침 문의 메일 | `tools/build.mjs` 의 privacy 페이지 → 빌드 |
| 약관·방침 시행일과 ‘초안’ 문구 | `tools/build.mjs` → 빌드 |
| 개인 도메인 연결 시 사이트 주소 | `tools/shell.mjs` 의 `SITE` 상수 → 빌드 |

## 8. 브랜드 · 디자인

**이름** 혼플 = 혼자 + 플레이스. 풀어 쓰면 ‘혼자 가기 좋은 플레이스’.
**한 줄 문구** 오늘은 혼자 가기 좋은 플레이스로.

**모티프** 한 줄에 늘어선 플레이스, 그중 하나에 불이 켜져 있는 그림 하나로 통일했습니다.
- 로고: 바닥선 위에 불 켜진 곳 하나, 아직 불 안 켜진 곳 하나
- 홈 히어로: 같은 그림을 화면 폭으로 늘린 것. 불 켜진 자리는 요일마다 바뀝니다
- 혼자 지수: 같은 형태의 작은 불빛 다섯 개
- 페이지는 낮(흰 배경)에서 시작해 밤(어두운 푸터)으로 끝납니다

**색** 흰색 #FFFFFF, 연한 회색 #F3F3F0, 글자 #1C1C21. 포인트는 램프 노랑 #F3B640 하나, 글자용 꿀색 #9A6512.

**서체** 고운바탕(제목·문장·글) + 프리텐다드(메뉴·표·버튼). CDN에서 불러옵니다.

**구조 원칙**
- 홈의 추천은 버튼 나열이 아니라 사용자의 문장입니다. 시간 칸은 접속 시각으로 미리 채워집니다
- 게시글은 편지처럼 본문이 먼저, 끝에 "— 이름"으로 서명합니다
- 목록은 카드가 아니라 표와 목차입니다

## 9. 플레이스 정보에 대하여

등록된 곳은 언론 보도, 미쉐린 가이드, 공식 소개, 지역 매체 등 공개 자료를 바탕으로 정리한 것입니다. 운영시간·가격·입장 규칙은 자주 바뀌므로 각 페이지에 ‘방문 전 확인’ 문구를 두었습니다.

조사 과정에서 폐업·영업중단이 확인된 곳은 등록하지 않았습니다. 운영이 불확실한 곳은 `notes` 에 확인이 필요하다고 적어 두었습니다. 틀린 정보를 발견하면 각 페이지의 ‘정보 수정 제안’으로 접수되고, 관리자 **제보** 탭에서 확인할 수 있습니다.
