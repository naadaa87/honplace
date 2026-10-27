/* 혼플 — 공통 셸 템플릿
   모든 페이지의 <head>, 헤더, 푸터, 탭바를 한 곳에서 만듭니다. */

/* 사이트의 정식 주소. canonical·og:url·sitemap·rss·JSON-LD 가 모두 이 값을 씁니다.
   주소를 바꿀 때는 이 한 줄만 고치고 `node tools/build.mjs` 를 실행하면
   전 페이지에 반영됩니다. 끝에 슬래시를 붙이지 않습니다.
   ※ 실제로 열리는 주소인지 확인한 뒤에 바꿔야 합니다. 열리지 않는 주소로 바꾸면
      모든 페이지의 canonical 이 없는 곳을 가리켜 검색 노출에 손해가 큽니다. */
export const SITE = 'https://honplace.com';
export const BRAND = '혼플';
export const TAGLINE = '혼자 가기 좋은 플레이스';
export const ICON = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="/assets/img/icons.svg#${id}"></use></svg>`;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* 사이트 전역 구조화 데이터 */
const orgLd = {
  '@type': 'Organization',
  '@id': SITE + '/#org',
  name: BRAND,
  alternateName: ['혼플', 'honplace', '혼자 가기 좋은 플레이스'],
  url: SITE + '/',
  logo: SITE + '/assets/img/og.png',
  description: '혼자 가기 좋은 플레이스를 모으고, 혼자 지수와 대화 온도로 고를 수 있게 정리하는 서비스입니다.'
};
const siteLd = {
  '@type': 'WebSite',
  '@id': SITE + '/#website',
  url: SITE + '/',
  name: BRAND,
  inLanguage: 'ko-KR',
  publisher: { '@id': SITE + '/#org' },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: SITE + '/spaces?q={search_term_string}' },
    'query-input': 'required name=search_term_string'
  }
};

/**
 * @param {object} o
 *  path      '/', '/spaces', '/place/xxx' — 슬래시로 시작하는 정식 경로(확장자 없음)
 *  file      실제 파일 경로 (예: 'place/xxx.html')
 *  title     <title> 에 들어갈 문구 (브랜드 접미사는 자동)
 *  desc      meta description
 *  body      본문 HTML
 *  scripts   ['home.js'] 형태
 *  ld        추가 JSON-LD 객체 배열
 *  crumbs    [{name, path}] 빵부스러기 (마지막 항목이 현재 페이지)
 *  ogType    기본 website
 *  noTab     하단 탭바 숨김
 *  noIndex   검색 제외
 *  head      <head> 에 덧붙일 문자열
 */
export function shell(o) {
  const isHome = o.path === '/';
  const fullTitle = isHome ? `${BRAND} — ${TAGLINE}` : `${o.title} | ${BRAND}`;
  const url = SITE + o.path;
  const ogImage = o.ogImage || SITE + '/assets/img/og.png';

  const graph = [orgLd, siteLd];
  if (o.crumbs?.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [{ name: '홈', path: '/' }, ...o.crumbs].map((c, i) => ({
        '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.path
      }))
    });
  }
  if (o.ld) graph.push(...o.ld);

  const nav = [
    ['/spaces', '플레이스'],
    ['/guide', '혼자 하는 법'],
    ['/magazine', '매거진'],
    ['/board', '이름 없는 이야기'],
    ['/about', '소개']
  ];

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${url}">
${o.noIndex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">'}
<meta name="author" content="${BRAND}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:locale" content="ko_KR">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${ogImage}">
<meta name="theme-color" content="#ffffff">
<meta name="format-detection" content="telephone=no">
<!-- 검색엔진 소유 확인 -->
<meta name="naver-site-verification" content="0efe77b67518e410ae0edd3bf246b4ef150bd949">
<!-- 구글 서치콘솔에서 받은 값을 넣고 주석을 푸세요 -->
<!-- <meta name="google-site-verification" content="여기에 구글 코드"> -->
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${BRAND} 매거진" href="${SITE}/rss.xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap">
<link rel="stylesheet" href="/assets/css/style.css">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>
${o.head || ''}
</head>
<body class="${o.noTab ? '' : 'has-tabbar'}">
<a class="sr" href="#main">본문으로 건너뛰기</a>
<header class="top"><div class="wrap">
  <a class="brand" href="/">${ICON('mark', 'mark')}${BRAND}</a>
  <nav class="nav" aria-label="주요 메뉴">
${nav.map(([h, t]) => `    <a href="${h}">${t}</a>`).join('\n')}
  </nav>
  <a class="btn lamp sm write-link" href="/board">한마디 남기기</a>
</div></header>
${o.crumbs?.length ? `<nav class="crumbs" aria-label="현재 위치"><div class="wrap"><a href="/">홈</a>${o.crumbs.map((c, i) => i === o.crumbs.length - 1 ? `<span aria-current="page">${esc(c.name)}</span>` : `<a href="${c.path}">${esc(c.name)}</a>`).join('')}</div></nav>` : ''}
<main id="main">
${o.body}
</main>
<footer class="foot"><div class="wrap">
  <div>
    <a class="brand" href="/">${ICON('mark', 'mark')}${BRAND}</a>
    <p class="tag-line">혼플은 ‘혼자 가기 좋은 플레이스’를 줄인 말입니다. 이름은 묻지 않습니다.</p>
  </div>
  <nav class="links" aria-label="푸터 메뉴">
    <a href="/spaces">플레이스 찾기</a><a href="/guide">혼자 하는 법</a><a href="/magazine">매거진</a><a href="/board">이름 없는 이야기</a><a href="/about">소개</a>
    <a href="/submit">플레이스 알려 주기</a><a href="/about#rules">게시판 규칙</a><a href="/terms">이용약관</a><a href="/privacy">개인정보처리방침</a>
  </nav>
  <div class="legal">운영 (회사명) &nbsp; 대표 (이름) &nbsp; 사업자등록번호 000-00-00000 &nbsp; 문의 hello@example.com<br>플레이스 정보는 공개 자료와 방문자 제보를 바탕으로 하며, 운영 시간과 규칙은 방문 전 확인이 필요합니다. © ${new Date().getFullYear()} ${BRAND}</div>
</div></footer>
${o.noTab ? '' : `<nav class="tabbar" aria-label="하단 메뉴">
  <a href="/">${ICON('nav-home')}<span>홈</span></a>
  <a href="/spaces">${ICON('nav-spaces')}<span>플레이스</span></a>
  <a href="/board">${ICON('nav-board')}<span>이야기</span></a>
  <a href="/guide">${ICON('nav-guide')}<span>하는 법</span></a>
</nav>`}
<script src="/assets/js/common.js"></script>
${(o.scripts || []).map((s) => `<script src="/assets/js/${s}"></script>`).join('\n')}
</body>
</html>
`;
}
