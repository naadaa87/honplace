/* 혼플 — 정적 페이지 생성기
   실행: node tools/build.mjs
   data/*.json 을 읽어 모든 html, sitemap.xml, rss.xml 을 다시 만듭니다. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shell, SITE, BRAND, BIZ, ICON, esc } from './shell.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf-8'));
const written = [];

function write(file, html) {
  const full = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
  written.push(file);
}

const { categories, spaces } = read('data/spaces.json');
const { groups, guides } = read('data/guides.json');
const { articles } = read('data/magazine.json');

const CAT = Object.fromEntries(categories.map((c) => [c.id, c]));
const TIME = { day: '낮', evening: '저녁', night: '밤늦게' };
const TALK = ['조용히 있어도 됨', '원하면 한마디', '이야기가 중심'];
const TALK_S = ['조용히', '원하면 한마디', '이야기 중심'];
const TIER = ['거의 무료', '1~2만 원', '3만 원 이상'];

const placeUrl = (id) => `/place/${id}`;
const byId = Object.fromEntries(spaces.map((s) => [s.id, s]));

/* ── 지역 묶기 ─────────────────────────── */
/* area 문자열에서 대표 지역 키를 뽑습니다. */
const AREA_DEFS = [
  { slug: 'seoul-mapo', name: '마포·홍대·연남', match: /마포|홍대|연남|합정|망원|상수|서교/ },
  { slug: 'seoul-jung', name: '을지로·중구·종로', match: /중구|을지로|종로|서촌|광화문|경희궁|삼청|인사동/ },
  { slug: 'seoul-seongdong', name: '성수·성동', match: /성동|성수|뚝섬|왕십리/ },
  { slug: 'seoul-yongsan', name: '용산·삼각지·이태원', match: /용산|삼각지|이태원|한남|해방촌/ },
  { slug: 'seoul-gangnam', name: '강남·서초·송파', match: /강남|서초|신사|압구정|청담|잠실|송파|삼성동|역삼/ },
  { slug: 'seoul-gwanak', name: '관악·동작·서울대입구', match: /관악|신림|동작|사당|서울대입구|노량진/ },
  { slug: 'seoul-yeongdeungpo', name: '영등포·문래·여의도', match: /영등포|문래|여의도|당산/ },
  { slug: 'seoul-seodaemun', name: '서대문·연희·신촌', match: /서대문|연희|신촌|이대|홍제/ },
  { slug: 'seoul-etc', name: '서울 그 밖', match: /서울/ },
  { slug: 'busan', name: '부산', match: /부산/ },
  { slug: 'daegu', name: '대구', match: /대구/ },
  { slug: 'incheon', name: '인천', match: /인천/ },
  { slug: 'daejeon', name: '대전', match: /대전/ },
  { slug: 'gwangju', name: '광주', match: /광주/ },
  { slug: 'jeju', name: '제주', match: /제주/ },
  { slug: 'gyeonggi', name: '경기·수도권', match: /경기|고양|성남|수원|용인|부천|일산|분당/ }
];
function areasOf(s) {
  const hay = `${s.area} ${s.addr || ''} ${(s.notes || []).join(' ')}`;
  const hit = AREA_DEFS.filter((a) => a.match.test(hay));
  // '서울 그 밖'은 다른 서울 구역에 안 걸렸을 때만
  const specific = hit.filter((a) => a.slug !== 'seoul-etc');
  if (specific.length) return specific;
  return hit;
}
const areaMap = new Map(AREA_DEFS.map((a) => [a.slug, { ...a, items: [] }]));
spaces.forEach((s) => areasOf(s).forEach((a) => areaMap.get(a.slug).items.push(s)));
const areas = [...areaMap.values()].filter((a) => a.items.length >= 2);

/* ── 조각 ──────────────────────────────── */
const seats = (n) => `<span class="seats" role="img" aria-label="혼자 지수 5점 만점에 ${n}점"><i class="${n >= 1 ? 'on' : ''}"></i><i class="${n >= 2 ? 'on' : ''}"></i><i class="${n >= 3 ? 'on' : ''}"></i><i class="${n >= 4 ? 'on' : ''}"></i><i class="${n >= 5 ? 'on' : ''}"></i></span>`;

function row(s, opt = {}) {
  const c = CAT[s.cat] || {};
  return `<a class="row" href="${placeUrl(s.id)}">
  <div class="c1">${seats(s.solo)}</div>
  <div class="c2">
    <div class="name">${esc(s.name)}${s.kind === 'type' ? '<span class="tag kind">유형</span>' : ''}</div>
    <div class="area">${esc(s.area)}${opt.cat === false ? '' : `<span class="cat">${esc(c.label || '')}</span>`}</div>
    ${opt.intro === false ? '' : `<p class="intro">${esc(s.intro)}</p>`}
  </div>
  <div class="meta"><span class="talk t${s.talk}">${TALK_S[s.talk]}</span><span class="num">${esc(s.price)}</span><span>${s.time.map((t) => TIME[t]).join(', ')}</span></div>
</a>`;
}
const sheetHead = `<div class="thead"><span>혼자 지수</span><span>어떤 곳</span><span>대화</span><span>비용</span><span>시간</span></div>`;
const sheet = (list, opt) => sheetHead + `<div class="sheet">${list.map((s) => row(s, opt)).join('')}</div>`;

/* 블록 렌더링 (가이드·매거진 공용) */
function blocks(bs) {
  return bs.map((b) => {
    const arr = b.x ?? b.items ?? [];
    if (b.t === 'h') return `<h2>${esc(b.x)}</h2>`;
    if (b.t === 'p') return `<p>${esc(b.x)}</p>`;
    if (b.t === 'ul') return `<ul>${arr.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    if (b.t === 'ol') return `<ol>${arr.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`;
    if (b.t === 'quote') return `<blockquote>${esc(b.x)}</blockquote>`;
    if (b.t === 'places') {
      const list = arr.map((id) => byId[id]).filter(Boolean);
      if (!list.length) return '';
      return `<div class="inline-places"><p class="il-label">여기에 해당하는 곳</p>${sheet(list, { intro: false })}</div>`;
    }
    if (b.t === 'faq') {
      return `<div class="faq"><h2>자주 묻는 것</h2>${arr.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>`;
    }
    return '';
  }).join('\n');
}
const faqLd = (bs) => {
  const f = bs.find((b) => b.t === 'faq');
  if (!f) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: (f.x ?? f.items ?? []).map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } }))
  };
};

/* ══════════════════════════════════════════
   1. 홈
   ══════════════════════════════════════════ */
{
  const featured = spaces.filter((s) => s.kind === 'place').slice(0, 6);
  write('index.html', shell({
    path: '/', file: 'index.html',
    title: BRAND,
    desc: '혼플은 ‘혼자 가기 좋은 플레이스’를 줄인 말입니다. 서울·전국의 혼술바, 혼밥 식당, 카페, 영화관, 사우나를 혼자 지수와 대화 온도로 골라 보세요.',
    scripts: ['feed.js', 'home.js'],
    ld: [{
      '@type': 'CollectionPage',
      '@id': SITE + '/#webpage',
      url: SITE + '/',
      name: `${BRAND} — 혼자 가기 좋은 플레이스`,
      isPartOf: { '@id': SITE + '/#website' },
      about: { '@type': 'Thing', name: '혼자 가기 좋은 장소' }
    }],
    body: `
<section class="hero"><div class="wrap">
  <p class="now" data-now>지금 갈 수 있는 플레이스부터 골라 두었어요.</p>
  <h1>오늘은 혼자 가기<br>좋은 플레이스로.</h1>
  <p class="sentence" data-sentence>오늘은 <button type="button" class="blank" data-k="mood" data-ph="어떤" data-empty="true" aria-expanded="false">어떤</button> 날이에요. <button type="button" class="blank" data-k="time" data-ph="언제" data-empty="true" aria-expanded="false">언제</button> 나갈 생각이고, 쓸 수 있는 돈은 <button type="button" class="blank" data-k="budget" data-ph="얼마쯤" data-empty="true" aria-expanded="false">얼마쯤</button>.</p>
  <div class="options" data-options></div>
  <p class="hint">빈칸을 눌러 채우면 맞는 플레이스가 나옵니다. 하나만 채워도 됩니다.</p>
  <div class="lights" data-lights aria-hidden="true"></div>
  <div class="picks" data-picks></div>
</div></section>

<section class="ed"><div class="wrap">
  <div class="lead">
    <h2>어떤 곳이<br>있나</h2>
    <p>혼자여도 눈에 띄지 않는 정도를 혼자 지수로, 말을 얼마나 하게 되는지를 대화 온도로 적어 두었습니다. 좋고 나쁨이 아니라 오늘 기분에 맞는지를 보는 표시입니다.</p>
    <a class="more" href="/spaces">전체 ${spaces.length}곳 보기</a>
  </div>
  <div class="toc">
${categories.map((c) => {
  const n = spaces.filter((s) => s.cat === c.id).length;
  return `    <a href="/c/${c.id}">${ICON('cat-' + c.id)}<span><span class="t">${esc(c.label)}</span><span class="d">${esc(c.desc)}</span></span><span class="n">${n}곳</span></a>`;
}).join('\n')}
  </div>
</div></section>

<section class="band"><div class="wrap">
  <p class="q">혼자 사는 사람 둘 중 하나는 외롭다고 답했습니다. 이상한 게 아니라, 지금 대부분이 놓인 상태입니다.</p>
  <div class="r">
    <p>혼플은 관계를 만들어 주지 않습니다. 대신 혼자 나가도 괜찮은 곳이 어디인지 알려 주고, 이름 없이 말할 수 있는 자리를 둡니다. 외로울 때 필요한 것이 꼭 사람은 아닙니다. 사람 기척이 있는 곳에 혼자 앉아 있는 것만으로 나아지는 날이 있습니다.</p>
    <span class="src">국가데이터처 「2025년 사회조사」, 1인 가구 48.9%가 평소 외로움을 느낀다고 응답</span>
    <div class="actions"><a class="btn" href="/magazine/loneliness-data">혼자 사는 사람의 외로움</a><a class="btn ghost" href="/guide/one-small-step">오늘 할 수 있는 가장 작은 것</a></div>
  </div>
</div></section>

<section class="ed"><div class="wrap">
  <div class="lead">
    <h2>동네별로<br>찾기</h2>
    <p>같은 혼술이라도 동네마다 문법이 다릅니다. 가려는 지역부터 고르면 실패가 줄어듭니다.</p>
  </div>
  <div class="chips wrapchips">
${areas.map((a) => `    <a class="chip" href="/area/${a.slug}">${esc(a.name)} <span class="n">${a.items.length}</span></a>`).join('\n')}
  </div>
</div></section>

<section class="ed"><div class="wrap">
  <div class="lead">
    <h2>오늘의<br>플레이스</h2>
    <p>실제로 운영 중인 곳들입니다. 눌러 보면 분위기와 처음 가면 알아 둘 것이 적혀 있습니다.</p>
    <a class="more" href="/spaces">전부 보기</a>
  </div>
  <div>${sheet(featured)}</div>
</div></section>

<section class="ed"><div class="wrap">
  <div class="lead">
    <h2>이름 없이<br>남긴 이야기</h2>
    <p>가입도 프로필도 없습니다. 그날의 이름 하나로 쓰고, 끝에 서명만 남깁니다.</p>
    <a class="more" href="/board">더 읽기</a>
  </div>
  <div>
    <div class="feed" data-home-feed><div class="sk">불러오는 중</div></div>
    <p style="margin:18px 0 0"><a class="btn lamp" href="/board">한마디 남기기</a></p>
  </div>
</div></section>

<section class="ed"><div class="wrap">
  <div class="lead">
    <h2>읽을거리</h2>
    <p>혼자 나가기 전에 알아 두면 편한 것들을 정리했습니다.</p>
    <a class="more" href="/magazine">매거진 전체</a>
  </div>
  <div class="gtoc">
${articles.slice(0, 5).map((a) => `    <a class="gi" href="/magazine/${a.id}"><span class="l1"><span class="t">${esc(a.title)}</span><span class="lead-line"></span><span class="m">${a.minutes}분</span></span><span class="sub">${esc(a.lead)}</span></a>`).join('\n')}
  </div>
</div></section>
`
  }));
}

/* ══════════════════════════════════════════
   2. 플레이스 목록
   ══════════════════════════════════════════ */
{
  const sorted = [...spaces].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'place' ? -1 : 1) || b.solo - a.solo);
  write('spaces.html', shell({
    path: '/spaces', file: 'spaces.html',
    title: `혼자 가기 좋은 플레이스 ${spaces.length}곳`,
    desc: `혼술바, 혼밥 식당, 카페·서점, 영화관, 사우나까지 혼자 가기 좋은 플레이스 ${spaces.length}곳. 혼자 지수와 대화 온도, 예산과 시간대로 골라 보세요.`,
    scripts: ['spaces.js'],
    crumbs: [{ name: '플레이스', path: '/spaces' }],
    ld: [{
      '@type': 'ItemList',
      name: '혼자 가기 좋은 플레이스',
      numberOfItems: spaces.length,
      itemListElement: sorted.slice(0, 50).map((s, i) => ({
        '@type': 'ListItem', position: i + 1, url: SITE + placeUrl(s.id), name: s.name
      }))
    }],
    body: `
<section class="ph"><div class="wrap">
  <h1>혼자 가기 좋은 플레이스</h1>
  <p>혼자 지수는 혼자여도 눈에 띄지 않는 정도, 대화 온도는 말을 얼마나 하게 되는지입니다. 순위가 아니라 오늘 기분에 맞는 곳을 고르기 위한 표시입니다. 지금 ${spaces.length}곳이 등록되어 있습니다.</p>
</div></section>
<section><div class="wrap">
  <div class="filters" data-filters>
    <label class="search">${ICON('i-search')}<input type="search" data-q placeholder="이름, 동네, 분위기로 찾기" aria-label="플레이스 검색"></label>
    <div class="frow"><span class="fl">종류</span><div class="chips scroll" data-f-cat></div></div>
    <div class="frow"><span class="fl">대화</span><div class="chips scroll">
      <button class="chip" data-k="talk" data-v="">전부</button>
      <button class="chip" data-k="talk" data-v="0">조용히 있어도 됨</button>
      <button class="chip" data-k="talk" data-v="1">원하면 한마디</button>
      <button class="chip" data-k="talk" data-v="2">이야기가 중심</button>
    </div></div>
    <div class="frow"><span class="fl">시간</span><div class="chips scroll">
      <button class="chip" data-k="time" data-v="">아무 때나</button>
      <button class="chip" data-k="time" data-v="day">낮</button>
      <button class="chip" data-k="time" data-v="evening">저녁</button>
      <button class="chip" data-k="time" data-v="night">밤늦게</button>
    </div></div>
  </div>
  <div class="count" data-count>${spaces.length}곳</div>
  <div data-list>${sheet(sorted)}</div>
  <p class="small muted" style="margin:28px 0 8px">여기 없는 곳을 알고 있다면 <a href="/submit">알려 주세요</a>. 보내는 사람의 이름은 묻지 않습니다.</p>
</div></section>

<section class="ed"><div class="wrap">
  <div class="lead"><h2>동네로<br>좁히기</h2><p>지역을 먼저 고르면 선택지가 훨씬 줄어듭니다.</p></div>
  <div class="chips wrapchips">
${areas.map((a) => `    <a class="chip" href="/area/${a.slug}">${esc(a.name)} <span class="n">${a.items.length}</span></a>`).join('\n')}
  </div>
</div></section>
`
  }));
}

/* ══════════════════════════════════════════
   3. 플레이스 상세 (정적)
   ══════════════════════════════════════════ */
for (const s of spaces) {
  const c = CAT[s.cat] || {};
  const q = encodeURIComponent(s.mapq || s.name);
  const naver = 'https://map.naver.com/p/search/' + q;
  const google = 'https://www.google.com/maps/search/?api=1&query=' + q;
  const kakao = 'https://map.kakao.com/?q=' + q;
  const more = spaces.filter((x) => x.cat === s.cat && x.id !== s.id).slice(0, 4);
  const sameArea = spaces.filter((x) => x.id !== s.id && areasOf(x).some((a) => areasOf(s).some((b) => b.slug === a.slug))).slice(0, 4);

  const ld = [{
    '@type': s.kind === 'place' ? 'LocalBusiness' : 'Thing',
    '@id': SITE + placeUrl(s.id) + '#place',
    name: s.name,
    description: s.intro,
    url: SITE + placeUrl(s.id),
    ...(s.addr ? { address: { '@type': 'PostalAddress', streetAddress: s.addr, addressCountry: 'KR' } } : {}),
    ...(s.kind === 'place' ? { areaServed: s.area } : {})
  }, {
    '@type': 'WebPage',
    url: SITE + placeUrl(s.id),
    name: `${s.name} — 혼자 가기 좋은 플레이스`,
    isPartOf: { '@id': SITE + '/#website' },
    primaryImageOfPage: SITE + '/assets/img/og.png'
  }];

  write(`place/${s.id}.html`, shell({
    path: placeUrl(s.id), file: `place/${s.id}.html`,
    title: `${s.name} — 혼자 가도 되는 ${c.label}`,
    desc: `${s.name}(${s.area}) — ${s.intro} 혼자 지수 ${s.solo}/5, 대화 온도 ‘${TALK[s.talk]}’, 비용 ${s.price}.`,
    scripts: ['feed.js', 'place.js'],
    ogType: 'article',
    crumbs: [{ name: '플레이스', path: '/spaces' }, { name: c.label, path: `/c/${s.cat}` }, { name: s.name, path: placeUrl(s.id) }],
    ld,
    head: `<meta name="keywords" content="${esc([s.name, s.area, c.label, '혼자 가기 좋은 곳', ...(s.tags || [])].join(', '))}">`,
    body: `
<article class="wrap read" data-space-id="${esc(s.id)}">
  <div class="sp-head">
    <div class="cat"><a href="/c/${s.cat}">${esc(c.label)}</a>${s.kind === 'type' ? '<span class="tag kind">유형</span>' : ''}</div>
    <h1>${esc(s.name)}${s.host?.verified ? `<span class="hb-badge" title="운영자가 확인한 호스트">${ICON('i-check')}호스트 확인</span>` : ''}</h1>
    <div class="area">${esc(s.area)}</div>
    ${s.addr ? `<div class="addr">${esc(s.addr)}</div>` : ''}
  </div>
  <div class="facts">
    <div class="f"><small>혼자 지수</small>${seats(s.solo)}</div>
    <div class="f"><small>대화 온도</small><span class="talk t${s.talk}">${TALK[s.talk]}</span></div>
    <div class="f"><small>비용</small><b class="num">${esc(s.price)}</b></div>
    <div class="f"><small>어울리는 시간</small><b>${s.time.map((t) => TIME[t]).join(', ')}</b></div>
  </div>
  <div class="sp-body">
    <h2>어떤 곳인가요</h2><p>${esc(s.intro)}</p>
    <h2>분위기와 문화</h2><p>${esc(s.culture)}</p>
    <h2>처음 가면</h2><p>${esc(s.first)}</p>
    ${s.host?.note ? `<div class="host-box">
      <div class="hb-head">
        <span class="hb-badge">${ICON('i-check')}호스트 안내</span>
        ${s.host.verified ? `<span class="hb-date">${esc(s.host.verified)} 확인</span>` : ''}
      </div>
      <h2 style="margin:0 0 10px">${esc(s.host.title || '운영자가 직접 쓴 안내')}</h2>
      ${s.host.seats || s.host.hours ? `<dl>
        ${s.host.seats ? `<dt>1인 좌석</dt><dd>${esc(s.host.seats)}</dd>` : ''}
        ${s.host.hours ? `<dt>운영 시간</dt><dd>${esc(s.host.hours)}</dd>` : ''}
      </dl>` : ''}
      <p>${esc(s.host.note)}</p>
      <div class="hb-foot">이 공간을 운영하는 분이 직접 적은 내용입니다. 혼플은 등급이나 순위를 매기지 않으며, 호스트 등록 여부는 혼자 지수·대화 온도에 영향을 주지 않습니다.${s.host.link ? ` <a href="${esc(s.host.link)}" target="_blank" rel="noopener nofollow">공식 채널</a>` : ''}</div>
    </div>` : ''}
    ${s.notes?.length ? `<h2>알아 두면 좋아요</h2><ul>${s.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${s.tags?.length ? `<div class="tags">${s.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="actions">
      <a class="btn" href="${naver}" target="_blank" rel="noopener nofollow">${ICON('i-pin')}네이버지도${s.kind === 'type' ? '에서 찾기' : ''}</a>
      <a class="btn" href="${google}" target="_blank" rel="noopener nofollow">${ICON('i-pin')}구글지도${s.kind === 'type' ? '에서 찾기' : ''}</a>
      <a class="btn ghost" href="${kakao}" target="_blank" rel="noopener nofollow">카카오맵</a>
      <a class="btn ghost" href="/submit?fix=${encodeURIComponent(s.id)}">정보 수정 제안</a>
    </div>
    <p class="small muted" style="margin-top:10px">${s.kind === 'type' ? '유형이라 특정 가게가 아닙니다. 지도 버튼을 누르면 가까운 곳을 찾을 수 있습니다.' : '운영 시간과 규칙은 바뀔 수 있습니다. 방문 전 지도에서 한 번 확인해 주세요.'}</p>
  </div>
</article>

<section class="ed"><div class="wrap">
  <div class="lead"><h2>혼자 다녀온<br>이야기</h2><p>여기에 혼자 다녀온 사람들이 이름 없이 남겼습니다.</p></div>
  <div>
    <div data-space-notice></div>
    <div data-space-composer></div>
    <div class="feed" data-space-feed></div>
  </div>
</div></section>

<section class="sp-more wrap read">
  ${more.length ? `<h2>비슷한 곳</h2>${sheet(more, { cat: false })}<p style="margin:14px 0 24px"><a class="btn ghost sm" href="/c/${s.cat}">${esc(c.label)} 전부 보기</a></p>` : ''}
  ${sameArea.length ? `<h2>이 근처의 다른 곳</h2>${sheet(sameArea, { cat: true })}` : ''}
</section>

${s.kind === 'place' && !s.host?.verified ? `<section class="wrap read" style="padding:0 var(--gutter) 44px">
  <div class="host-cta">
    <div>
      <b>이 공간을 운영하고 계신가요</b>
      호스트로 등록하시면 혼자 오는 손님을 위한 안내를 직접 쓰고, 운영 정보를 바로잡고, 남겨진 후기에 답하실 수 있습니다. 등록과 이용은 무료입니다.
    </div>
    <a class="btn" href="/host">호스트 등록 안내</a>
  </div>
</section>` : ''}
`
  }));
}

/* ══════════════════════════════════════════
   4. 카테고리 랜딩
   ══════════════════════════════════════════ */
for (const c of categories) {
  const list = spaces.filter((s) => s.cat === c.id).sort((a, b) => b.solo - a.solo);
  if (!list.length) continue;
  const quiet = list.filter((s) => s.talk === 0);
  const talky = list.filter((s) => s.talk === 2);
  const cheap = list.filter((s) => s.tier === 0);
  const night = list.filter((s) => s.time.includes('night'));
  const rel = articles.filter((a) => a.blocks.some((b) => b.t === 'places' && b.x.some((id) => byId[id]?.cat === c.id))).slice(0, 4);

  write(`c/${c.id}.html`, shell({
    path: `/c/${c.id}`, file: `c/${c.id}.html`,
    title: `혼자 가기 좋은 ${c.label} ${list.length}곳`,
    desc: `${c.label} — ${c.desc}. 혼자 지수와 대화 온도로 정리한 ${list.length}곳. ${list.slice(0, 4).map((s) => s.name).join(', ')} 등.`,
    crumbs: [{ name: '플레이스', path: '/spaces' }, { name: c.label, path: `/c/${c.id}` }],
    ld: [{
      '@type': 'ItemList', name: `혼자 가기 좋은 ${c.label}`, numberOfItems: list.length,
      itemListElement: list.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + placeUrl(s.id), name: s.name }))
    }],
    body: `
<section class="ph"><div class="wrap">
  <h1>혼자 가기 좋은 ${esc(c.label)}</h1>
  <p>${esc(c.desc)}. 지금 ${list.length}곳이 등록되어 있습니다. 혼자 지수가 높은 순서로 정렬했습니다.</p>
</div></section>
<div class="wrap">
  ${quiet.length ? `<h2 class="sec">아무 말도 하기 싫은 날</h2>${sheet(quiet, { cat: false })}` : ''}
  ${talky.length ? `<h2 class="sec">몇 마디 나누고 싶은 날</h2>${sheet(talky, { cat: false })}` : ''}
  ${cheap.length ? `<h2 class="sec">돈이 거의 들지 않는 곳</h2>${sheet(cheap, { cat: false })}` : ''}
  ${night.length ? `<h2 class="sec">밤늦게도 되는 곳</h2>${sheet(night, { cat: false })}` : ''}
  <h2 class="sec">${esc(c.label)} 전체</h2>
  ${sheet(list, { cat: false })}
</div>
${rel.length ? `<section class="ed"><div class="wrap">
  <div class="lead"><h2>함께 읽기</h2><p>${esc(c.label)}과 관련된 글입니다.</p></div>
  <div class="gtoc">${rel.map((a) => `<a class="gi" href="/magazine/${a.id}"><span class="l1"><span class="t">${esc(a.title)}</span><span class="lead-line"></span><span class="m">${a.minutes}분</span></span><span class="sub">${esc(a.lead)}</span></a>`).join('')}</div>
</div></section>` : ''}
<section class="wrap" style="padding-bottom:40px">
  <h2 class="sec">다른 종류</h2>
  <div class="chips wrapchips">${categories.filter((x) => x.id !== c.id).map((x) => `<a class="chip" href="/c/${x.id}">${esc(x.label)}</a>`).join('')}</div>
</section>
`
  }));
}

/* ══════════════════════════════════════════
   5. 지역 랜딩
   ══════════════════════════════════════════ */
for (const a of areas) {
  const list = a.items.sort((x, y) => b_solo(y) - b_solo(x));
  function b_solo(s) { return s.solo; }
  const catsHere = categories.filter((c) => list.some((s) => s.cat === c.id));
  write(`area/${a.slug}.html`, shell({
    path: `/area/${a.slug}`, file: `area/${a.slug}.html`,
    title: `${a.name}에서 혼자 가기 좋은 곳 ${list.length}곳`,
    desc: `${a.name} 혼자 가기 좋은 플레이스 ${list.length}곳 — ${list.slice(0, 5).map((s) => s.name).join(', ')} 등. 혼자 지수와 대화 온도로 정리했습니다.`,
    crumbs: [{ name: '플레이스', path: '/spaces' }, { name: a.name, path: `/area/${a.slug}` }],
    ld: [{
      '@type': 'ItemList', name: `${a.name} 혼자 가기 좋은 곳`, numberOfItems: list.length,
      itemListElement: list.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + placeUrl(s.id), name: s.name }))
    }],
    body: `
<section class="ph"><div class="wrap">
  <h1>${esc(a.name)}에서 혼자</h1>
  <p>${esc(a.name)} 일대에서 혼자 가기 좋은 곳 ${list.length}곳입니다. 종류별로 묶어 두었습니다.</p>
</div></section>
<div class="wrap">
${catsHere.map((c) => {
  const sub = list.filter((s) => s.cat === c.id);
  return `  <h2 class="sec">${esc(c.label)}</h2>${sheet(sub, { cat: false })}`;
}).join('\n')}
</div>
<section class="wrap" style="padding:30px 0 40px">
  <h2 class="sec">다른 동네</h2>
  <div class="chips wrapchips">${areas.filter((x) => x.slug !== a.slug).map((x) => `<a class="chip" href="/area/${x.slug}">${esc(x.name)} <span class="n">${x.items.length}</span></a>`).join('')}</div>
</section>
`
  }));
}

/* ══════════════════════════════════════════
   6. 가이드 (목차 + 정적 글)
   ══════════════════════════════════════════ */
write('guide/index.html', shell({
  path: '/guide', file: 'guide/index.html',
  title: '혼자 하는 법',
  desc: '혼술바에 처음 가는 법, 혼밥이 어색한 사람을 위한 순서, 잠 안 오는 밤에 갈 수 있는 곳. 혼자 하는 법을 정리한 안내 모음입니다.',
  crumbs: [{ name: '혼자 하는 법', path: '/guide' }],
  ld: [{ '@type': 'ItemList', name: '혼자 하는 법', itemListElement: guides.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + '/guide/' + g.id, name: g.title })) }],
  body: `
<section class="ph"><div class="wrap read"><h1>혼자 하는 법</h1><p>처음 가는 사람을 위한 안내와, 혼자에 대한 짧은 글. 읽는 데 몇 분이면 됩니다.</p></div></section>
<div class="wrap read" style="padding-top:12px">
${groups.map((g) => {
  const items = guides.filter((x) => x.group === g.id);
  if (!items.length) return '';
  return `<section class="g-group"><h3>${esc(g.label)}</h3><div class="gtoc">${items.map((x) => `<a class="gi" href="/guide/${x.id}"><span class="l1"><span class="t">${esc(x.title)}</span><span class="lead-line"></span><span class="m">${x.minutes}분</span></span><span class="sub">${esc(x.lead)}</span></a>`).join('')}</div></section>`;
}).join('\n')}
<section class="g-group"><h3>더 긴 글</h3><div class="gtoc">${articles.slice(0, 4).map((a) => `<a class="gi" href="/magazine/${a.id}"><span class="l1"><span class="t">${esc(a.title)}</span><span class="lead-line"></span><span class="m">${a.minutes}분</span></span><span class="sub">${esc(a.lead)}</span></a>`).join('')}</div>
<p style="margin:16px 0 0"><a class="btn ghost sm" href="/magazine">매거진 전체 보기</a></p></section>
</div>
`
}));

for (const g of guides) {
  const grp = groups.find((x) => x.id === g.group);
  const others = guides.filter((x) => x.id !== g.id && x.group === g.group).slice(0, 3);
  const ld = [{
    '@type': 'Article',
    headline: g.title,
    description: g.lead,
    inLanguage: 'ko-KR',
    author: { '@id': SITE + '/#org' },
    publisher: { '@id': SITE + '/#org' },
    mainEntityOfPage: SITE + '/guide/' + g.id,
    image: SITE + '/assets/img/og.png'
  }];
  const f = faqLd(g.blocks); if (f) ld.push(f);
  write(`guide/${g.id}.html`, shell({
    path: '/guide/' + g.id, file: `guide/${g.id}.html`,
    title: g.title,
    desc: g.lead,
    ogType: 'article',
    crumbs: [{ name: '혼자 하는 법', path: '/guide' }, { name: g.title, path: '/guide/' + g.id }],
    ld,
    body: `
<article class="article wrap read">
  <div class="kicker">${esc(grp?.label || '')}<span style="margin-left:12px">${g.minutes}분 읽기</span></div>
  <h1>${esc(g.title)}</h1>
  <p class="lead">${esc(g.lead)}</p>
  ${blocks(g.blocks)}
  <div class="end">
    <a class="btn ghost" href="/guide">다른 안내 보기</a>
    <a class="btn ghost" href="/spaces">플레이스 찾기</a>
  </div>
</article>
${others.length ? `<section class="ed"><div class="wrap"><div class="lead"><h2>이어서<br>읽기</h2></div><div class="gtoc">${others.map((x) => `<a class="gi" href="/guide/${x.id}"><span class="l1"><span class="t">${esc(x.title)}</span><span class="lead-line"></span><span class="m">${x.minutes}분</span></span><span class="sub">${esc(x.lead)}</span></a>`).join('')}</div></div></section>` : ''}
`
  }));
}

/* ══════════════════════════════════════════
   7. 매거진
   ══════════════════════════════════════════ */
write('magazine/index.html', shell({
  path: '/magazine', file: 'magazine/index.html',
  title: '매거진 — 혼자 보내는 시간에 대하여',
  desc: '서울 혼술 지도, 혼밥 레벨, 주말에 혼자 뭐 하지, 비 오는 날 갈 만한 곳. 혼자 보내는 시간을 다룬 글 모음입니다.',
  crumbs: [{ name: '매거진', path: '/magazine' }],
  ld: [{ '@type': 'Blog', name: `${BRAND} 매거진`, url: SITE + '/magazine', publisher: { '@id': SITE + '/#org' } }],
  body: `
<section class="ph"><div class="wrap read"><h1>매거진</h1><p>혼자 보내는 시간에 대해 쓴 글들입니다. 어디로 갈지 정하기 전에 읽으면 선택이 쉬워집니다.</p></div></section>
<div class="wrap read" style="padding-top:12px">
  <div class="gtoc">
${articles.map((a) => `    <a class="gi" href="/magazine/${a.id}"><span class="l1"><span class="t">${esc(a.title)}</span><span class="lead-line"></span><span class="m">${a.minutes}분</span></span><span class="sub">${esc(a.lead)}</span></a>`).join('\n')}
  </div>
  <p class="small muted" style="margin:28px 0">${BRAND} 매거진은 <a href="/rss.xml">RSS</a>로도 구독할 수 있습니다.</p>
</div>
`
}));

for (const a of articles) {
  const others = articles.filter((x) => x.id !== a.id).slice(0, 3);
  const ld = [{
    '@type': 'Article',
    headline: a.title,
    description: a.lead,
    datePublished: a.date,
    dateModified: a.date,
    inLanguage: 'ko-KR',
    keywords: (a.keywords || []).join(', '),
    author: { '@id': SITE + '/#org' },
    publisher: { '@id': SITE + '/#org' },
    mainEntityOfPage: SITE + '/magazine/' + a.id,
    image: SITE + '/assets/img/og.png'
  }];
  const f = faqLd(a.blocks); if (f) ld.push(f);
  write(`magazine/${a.id}.html`, shell({
    path: '/magazine/' + a.id, file: `magazine/${a.id}.html`,
    title: a.title,
    desc: a.lead,
    ogType: 'article',
    crumbs: [{ name: '매거진', path: '/magazine' }, { name: a.title, path: '/magazine/' + a.id }],
    ld,
    head: `<meta name="keywords" content="${esc((a.keywords || []).join(', '))}">\n<meta property="article:published_time" content="${a.date}">`,
    body: `
<article class="article wrap read">
  <div class="kicker">매거진<span style="margin-left:12px">${a.minutes}분 읽기</span><span style="margin-left:12px">${esc(a.date)}</span></div>
  <h1>${esc(a.title)}</h1>
  <p class="lead">${esc(a.lead)}</p>
  ${blocks(a.blocks)}
  <div class="end">
    <a class="btn ghost" href="/magazine">매거진 전체</a>
    <a class="btn ghost" href="/spaces">플레이스 찾기</a>
  </div>
</article>
<section class="ed"><div class="wrap"><div class="lead"><h2>이어서<br>읽기</h2></div><div class="gtoc">${others.map((x) => `<a class="gi" href="/magazine/${x.id}"><span class="l1"><span class="t">${esc(x.title)}</span><span class="lead-line"></span><span class="m">${x.minutes}분</span></span><span class="sub">${esc(x.lead)}</span></a>`).join('')}</div></div></section>
`
  }));
}

/* ══════════════════════════════════════════
   8. 나머지 고정 페이지
   ══════════════════════════════════════════ */
write('board.html', shell({
  path: '/board', file: 'board.html',
  title: '이름 없는 이야기 — 익명 게시판',
  desc: '가입도 프로필도 없는 익명 게시판. 오늘 한마디, 그냥 이야기, 혼자 다녀온 곳, 어디 갈까요.',
  scripts: ['feed.js', 'board.js'],
  crumbs: [{ name: '이름 없는 이야기', path: '/board' }],
  body: `
<section class="ph"><div class="wrap read">
  <a class="back hide" data-back href="/board">게시판으로 돌아가기</a>
  <h1>이름 없이 남기는 이야기</h1>
  <p>가입도 프로필도 없습니다. 오늘의 이름 하나로 쓰고, 쓴 사람은 찾을 수 없습니다.</p>
  <div class="board-tabs" data-tabs></div>
</div></section>
<div class="wrap read">
  <div data-notice></div>
  <div data-composer-slot></div>
  <div class="feed" data-feed><div class="sk">불러오는 중</div></div>
  <p class="small muted" style="margin:26px 0 8px">지켜 주세요. 특정인을 지목하지 않기, 연락처를 주고받지 않기, 홍보하지 않기. <a href="/about#rules">전체 규칙</a></p>
</div>
`
}));

/* ── 호스트 등록 ───────────────────────── */
write('host.html', shell({
  path: '/host', file: 'host.html',
  title: '호스트 등록 — 공간을 운영하고 계신가요',
  desc: '혼자 오는 손님을 받는 공간이라면 호스트로 등록하세요. 혼플에 공식 안내를 올리고, 운영 정보를 직접 고치고, 혼자 다녀간 손님의 이야기에 답할 수 있습니다.',
  scripts: ['host.js'],
  crumbs: [{ name: '호스트 등록', path: '/host' }],
  ld: [faqLd([{ t: 'faq', x: [
    { q: '호스트 등록은 유료인가요?', a: '아닙니다. 등록과 이용 모두 무료입니다. 광고비를 받고 순위를 올려 주는 구조가 아니기 때문에 비용을 받지 않습니다.' },
    { q: '사업자등록번호를 왜 받나요?', a: '그 공간을 실제로 운영하는 분인지 확인하기 위해서입니다. 확인 용도로만 쓰고 사이트에 공개하지 않습니다.' },
    { q: '등록하면 검색 순위가 올라가나요?', a: '올라가지 않습니다. 혼플은 공간에 등급이나 순위를 매기지 않습니다. 대신 혼자 오는 손님이 알아야 할 정보를 호스트가 직접 쓸 수 있습니다.' },
    { q: '아직 혼플에 등록되지 않은 공간도 신청할 수 있나요?', a: '가능합니다. 신청 내용을 확인한 뒤 새로 등록해 드립니다.' },
    { q: '확인에는 얼마나 걸리나요?', a: '보통 며칠 안에 적어 주신 메일로 연락드립니다.' }
  ] }])],
  body: `
<section class="ph"><div class="wrap read">
  <h1>공간을 운영하고 계신가요</h1>
  <p>혼자 오는 손님을 받는 공간이라면 호스트로 등록하실 수 있습니다. 등록과 이용은 무료입니다.</p>
</div></section>

<div class="wrap read">
  <div class="host-why">
    <h2 class="sec">호스트가 되면</h2>
    <div class="hw-list">
      <div class="hw"><span class="hw-n">01</span><div>
        <b>공식 안내를 직접 씁니다</b>
        혼자 온 손님이 가장 궁금해하는 것은 ‘혼자 가도 되는지’입니다. 1인 좌석이 몇 개인지, 혼자 와도 편한 시간대가 언제인지, 1인 메뉴가 있는지를 호스트가 직접 적어 두면 손님이 망설이지 않습니다. 이 글은 익명 후기와 구분된 자리에 <b>호스트 안내</b>로 표시됩니다.
      </div></div>
      <div class="hw"><span class="hw-n">02</span><div>
        <b>정보를 바로잡을 수 있습니다</b>
        운영시간이나 가격이 바뀌면 알려 주세요. 혼플의 정보는 공개 자료를 바탕으로 정리한 것이라 실제와 다를 수 있습니다. 호스트가 알려 주는 정보가 가장 정확합니다.
      </div></div>
      <div class="hw"><span class="hw-n">03</span><div>
        <b>손님의 이야기에 답할 수 있습니다</b>
        혼자 다녀간 분들이 공간 페이지에 이름 없이 후기를 남깁니다. 인증된 호스트는 그 글에 답을 달 수 있습니다. 답글에는 호스트 표시가 붙습니다.
      </div></div>
      <div class="hw"><span class="hw-n">04</span><div>
        <b>인증 표시가 붙습니다</b>
        공간 페이지에 ‘호스트 확인’ 표시가 들어갑니다. 운영자가 직접 확인한 공간이라는 뜻입니다.
      </div></div>
    </div>
  </div>

  <div class="host-not">
    <h2 class="sec">미리 말씀드립니다</h2>
    <p>혼플은 공간에 <b>등급이나 순위를 매기지 않습니다.</b> 호스트로 등록해도 목록에서 위로 올라가지 않고, 광고비를 받고 노출을 올려 주는 자리도 없습니다. 혼자 지수와 대화 온도는 좋고 나쁨이 아니라 오늘 기분에 맞는 곳을 고르기 위한 표시이고, 이 기준은 호스트 등록 여부와 상관없이 같게 적용합니다.</p>
    <p>호스트가 쓴 글은 <b>광고가 아니라 안내여야 합니다.</b> ‘맛있습니다’ ‘최고입니다’ 같은 홍보 문구보다, 혼자 온 손님이 문을 열기 전에 알고 싶은 사실을 적어 주세요. 그편이 실제로 손님을 데려옵니다.</p>
  </div>

  <h2 class="sec" id="form">신청하기</h2>
  <p class="small muted" style="margin:0 0 18px">적어 주신 연락처는 확인과 회신에만 쓰고 사이트에 공개하지 않습니다. 자세한 내용은 <a href="/privacy">개인정보처리방침</a>을 봐 주세요.</p>

  <form class="form" data-host-form>
    <div class="field">
      <label for="h-space">공간 이름 <span class="req">필수</span></label>
      <input id="h-space" type="text" name="space_name" placeholder="가게 또는 공간의 정식 이름" required>
      <p class="help" data-match></p>
      <input type="hidden" name="space_id" value="">
    </div>

    <div class="grid2">
      <div class="field">
        <label for="h-cat">종류</label>
        <select id="h-cat" name="cat">
          <option value="">고르지 않음</option>
${categories.map((c) => `          <option value="${c.id}">${esc(c.label)}</option>`).join('\n')}
        </select>
      </div>
      <div class="field">
        <label for="h-area">동네 <small>시·구·동</small></label>
        <input id="h-area" type="text" name="area" placeholder="예: 서울 마포구 연남동">
      </div>
    </div>

    <div class="field">
      <label for="h-addr">주소</label>
      <input id="h-addr" type="text" name="addr" placeholder="도로명 주소">
    </div>

    <div class="field">
      <label for="h-biz">사업자등록번호 <span class="req">필수</span></label>
      <input id="h-biz" type="text" name="biz_no" inputmode="numeric" placeholder="000-00-00000" required>
      <p class="help">실제 운영자인지 확인하는 용도로만 씁니다. 사이트에 공개하지 않습니다.</p>
    </div>

    <div class="grid2">
      <div class="field">
        <label for="h-owner">담당자 이름 <span class="req">필수</span></label>
        <input id="h-owner" type="text" name="owner_name" placeholder="연락받으실 분" required>
      </div>
      <div class="field">
        <label for="h-email">이메일 <span class="req">필수</span></label>
        <input id="h-email" type="email" name="email" placeholder="회신받을 주소" required>
      </div>
    </div>

    <div class="grid2">
      <div class="field">
        <label for="h-phone">연락처 <small>선택</small></label>
        <input id="h-phone" type="text" name="phone" inputmode="tel" placeholder="전화번호">
      </div>
      <div class="field">
        <label for="h-link">홈페이지·SNS <small>선택</small></label>
        <input id="h-link" type="text" name="link" placeholder="인스타그램 주소 등">
      </div>
    </div>

    <div class="field">
      <label for="h-seats">1인 좌석 <small>선택</small></label>
      <input id="h-seats" type="text" name="solo_seats" placeholder="예: 카운터 6석, 창가 1인석 2자리">
    </div>

    <div class="field">
      <label for="h-note">혼자 오는 손님을 위한 안내 <span class="req">필수</span></label>
      <textarea id="h-note" name="solo_note" required placeholder="예: 바 좌석이 여섯 자리 있고 평일 저녁에는 대부분 혼자 오십니다. 주문은 자리에서 QR로 하시면 되고 말을 걸지 않습니다. 주말 7시 이후에는 일행 손님이 많아 혼자 오시기엔 평일이 편합니다."></textarea>
      <p class="help">혼자 온 손님이 문을 열기 전에 알고 싶은 것을 적어 주세요. 이 내용이 공간 페이지의 호스트 안내로 들어갑니다.</p>
    </div>

    <div class="field">
      <label for="h-msg">하고 싶은 말 <small>선택</small></label>
      <textarea id="h-msg" name="message" placeholder="고쳤으면 하는 정보, 궁금한 점 등"></textarea>
    </div>

    <label class="agree">
      <input type="checkbox" data-agree required>
      <span>개인정보 수집·이용에 동의합니다. 담당자 이름·연락처·사업자등록번호를 호스트 확인과 회신 목적으로 수집하며, 확인 완료 또는 철회 시까지 보관합니다. 동의를 거부하실 수 있으나 그 경우 호스트 등록이 어렵습니다. <a href="/privacy" target="_blank" rel="noopener">자세히</a></span>
    </label>

    <div class="submit">
      <button class="btn lamp" type="submit">신청 보내기</button>
      <a class="small muted" href="/spaces">그만두기</a>
    </div>
    <p class="form-err hide" data-err></p>
  </form>

  <div class="form hide" data-host-done>
    <div class="ok"><b>신청을 받았습니다.</b>적어 주신 메일로 확인 결과를 알려 드리겠습니다. 보통 며칠 안에 연락드립니다.
      <p class="hide small" data-done-demo style="margin:10px 0 0;color:var(--honey)">지금은 체험 모드라 이 기기에만 저장되었습니다. 데이터베이스 연결 후에는 운영자에게 바로 전달됩니다.</p>
    </div>
    <div class="submit"><a class="btn ghost" href="/spaces">플레이스 둘러보기</a><a class="btn ghost" href="/">처음으로</a></div>
  </div>

  <h2 class="sec">자주 묻는 것</h2>
  <div class="faq">
    <details><summary>호스트 등록은 유료인가요?</summary><p>아닙니다. 등록과 이용 모두 무료입니다. 광고비를 받고 순위를 올려 주는 구조가 아니기 때문에 비용을 받지 않습니다.</p></details>
    <details><summary>사업자등록번호를 왜 받나요?</summary><p>그 공간을 실제로 운영하는 분인지 확인하기 위해서입니다. 확인 용도로만 쓰고 사이트에 공개하지 않습니다.</p></details>
    <details><summary>등록하면 검색 순위가 올라가나요?</summary><p>올라가지 않습니다. 혼플은 공간에 등급이나 순위를 매기지 않습니다. 대신 혼자 오는 손님이 알아야 할 정보를 호스트가 직접 쓸 수 있습니다.</p></details>
    <details><summary>아직 혼플에 등록되지 않은 공간도 신청할 수 있나요?</summary><p>가능합니다. 신청 내용을 확인한 뒤 새로 등록해 드립니다.</p></details>
    <details><summary>확인에는 얼마나 걸리나요?</summary><p>보통 며칠 안에 적어 주신 메일로 연락드립니다.</p></details>
    <details><summary>등록을 취소하고 싶으면요?</summary><p>문의 메일로 알려 주시면 호스트 정보와 수집한 연락처를 지워 드립니다.</p></details>
  </div>

  <p class="small muted" style="margin:28px 0 40px">손님으로서 좋았던 곳을 알려 주시려면 <a href="/submit">플레이스 알려 주기</a>를 이용해 주세요. 그쪽은 이름을 묻지 않습니다.</p>
</div>
`
}));

write('submit.html', shell({
  path: '/submit', file: 'submit.html',
  title: '혼자 가기 좋은 플레이스 알려 주기',
  desc: '혼자 가도 괜찮았던 곳을 알려 주세요. 확인 후 혼플에 등록합니다. 보내는 사람의 이름은 묻지 않습니다.',
  scripts: ['submit.js'],
  crumbs: [{ name: '플레이스 알려 주기', path: '/submit' }],
  body: `
<section class="ph"><div class="wrap read"><h1 data-form-title>혼자 가기 좋은 플레이스 알려 주기</h1><p data-form-lead>혼자 가도 괜찮았던 곳을 알려 주세요. 확인 후 등록합니다. 보내는 사람의 이름은 묻지 않습니다.</p></div></section>
<div class="wrap read">
  <form class="form" data-submit-form>
    <input type="hidden" name="fix_id" value="">
    <div class="grid2">
      <div class="field"><label for="f-name">이름</label><input id="f-name" type="text" name="name" placeholder="가게 이름 또는 장소 이름" required></div>
      <div class="field"><label for="f-area">동네<small>시·구·동 정도면 됩니다</small></label><input id="f-area" type="text" name="area" placeholder="예: 서울 마포구 연남동"></div>
    </div>
    <div class="field"><label for="f-cat">종류</label>
      <select id="f-cat" name="cat">
${categories.map((c) => `        <option value="${c.id}">${esc(c.label)}</option>`).join('\n')}
      </select>
    </div>
    <div class="field" data-hide-on-fix><label>혼자 지수<small>혼자여도 눈에 띄지 않는 정도</small></label>
      <div class="seg"><input type="hidden" name="solo" value="4">
        <button type="button" class="chip" data-v="1">1, 튄다</button><button type="button" class="chip" data-v="2">2</button><button type="button" class="chip" data-v="3">3</button><button type="button" class="chip" data-v="4" aria-pressed="true">4</button><button type="button" class="chip" data-v="5">5, 아무도 안 본다</button>
      </div>
    </div>
    <div class="field" data-hide-on-fix><label>대화 온도<small>말을 얼마나 하게 되나요</small></label>
      <div class="seg"><input type="hidden" name="talk" value="0">
        <button type="button" class="chip" data-v="0" aria-pressed="true">조용히 있어도 됨</button><button type="button" class="chip" data-v="1">원하면 한마디</button><button type="button" class="chip" data-v="2">이야기가 중심</button>
      </div>
    </div>
    <div class="field"><label for="f-note">어떤 곳인가요<small>분위기, 규칙, 처음 가면 알아 둘 것</small></label><textarea id="f-note" name="note" placeholder="예: 바 자리만 있고 혼자 온 손님이 대부분. 사장이 말을 걸어 주지만 조용히 있어도 됨. 일행은 따로 앉힘." required></textarea></div>
    <div class="field" data-hide-on-fix><label for="f-time">어울리는 시간<small>선택</small></label><input id="f-time" type="text" name="time" placeholder="예: 평일 저녁, 주말 낮"></div>
    <p class="help">보내 주신 내용은 확인 후 등록하며, 보낸 사람의 정보는 저장하지 않습니다.</p>
    <div class="submit"><button class="btn lamp" type="submit">보내기</button><a class="small muted" href="/spaces">그만두기</a></div>
  </form>
  <div class="form hide" data-submit-done>
    <div class="ok"><b>보냈어요. 고마워요.</b>확인 후 혼플에 올립니다. 보통 며칠 안에 반영됩니다.<p class="hide small" data-done-demo style="margin:10px 0 0;color:var(--honey)">지금은 체험 모드라 이 기기에만 저장되었습니다. 데이터베이스 연결 후에는 운영자에게 바로 전달됩니다.</p></div>
    <div class="submit"><a class="btn ghost" href="/spaces">플레이스로</a><a class="btn ghost" href="/submit">하나 더 알려 주기</a></div>
  </div>
</div>
`
}));

write('about.html', shell({
  path: '/about', file: 'about.html',
  title: '소개 — 혼플은 무엇을 하는가',
  desc: '혼플은 혼자 가기 좋은 플레이스를 모으는 서비스입니다. 관계를 만들어 주지 않고, 이름을 묻지 않으며, 등급을 매기지 않습니다.',
  crumbs: [{ name: '소개', path: '/about' }],
  ld: [faqLd([{ t: 'faq', x: [
    { q: '혼플은 무슨 뜻인가요?', a: '‘혼자 가기 좋은 플레이스’를 줄인 말입니다.' },
    { q: '혼자 지수는 무엇인가요?', a: '혼자여도 눈에 띄지 않는 정도를 1에서 5까지로 표시한 것입니다. 5에 가까울수록 혼자 있는 것이 전혀 드러나지 않습니다.' },
    { q: '대화 온도는 무엇인가요?', a: '그곳에서 말을 얼마나 하게 되는지를 세 단계로 나눈 것입니다. 조용히 있어도 되는 곳, 원하면 한마디 할 수 있는 곳, 이야기가 중심인 곳입니다.' },
    { q: '가입을 해야 하나요?', a: '아닙니다. 가입도 프로필도 없습니다. 게시판에 글을 쓸 때 그날의 이름이 자동으로 하나 붙고, 다음 글에서 바꿔도 됩니다.' },
    { q: '플레이스 정보는 어디서 가져오나요?', a: '공개된 자료와 방문자 제보를 바탕으로 정리합니다. 운영 시간과 규칙은 바뀔 수 있으니 방문 전 확인이 필요합니다.' }
  ] }])],
  body: `
<div class="wrap prose about">
  <aside class="side">
    <a href="#what">무엇을 하는가</a>
    <a href="#not">무엇을 하지 않는가</a>
    <a href="#index">혼자 지수와 대화 온도</a>
    <a href="#why">왜 이름을 묻지 않는가</a>
    <a href="#rules">게시판에서 지켜 주세요</a>
    <a href="#info">플레이스 정보에 대하여</a>
  </aside>
  <article class="read">
    <h1>혼자 가기 좋은 플레이스.</h1>
    <p>혼플은 ‘혼자 가기 좋은 플레이스’를 줄인 말입니다. 국밥집 카운터, 도서관 창가, 밤의 한강 계단, 서서 마시는 술집, 그리고 낯선 사람과 몇 마디 나누게 되는 혼술바까지. 혼자 들어가도 어색하지 않은 곳들을 모아 두고, 각 곳이 어떤 분위기인지 적어 둡니다.</p>
    <p>지금 ${spaces.length}곳이 등록되어 있고, 계속 늘려 가고 있습니다.</p>

    <h2 id="what">무엇을 하는가</h2>
    <ul>
      <li>혼자 가기 좋은 플레이스를 모으고, 각 곳의 분위기와 문화, 처음 가면 알아 둘 것을 적어 둡니다.</li>
      <li>혼자 하는 법을 안내합니다. 혼술바에 처음 가는 법, 혼밥이 어색한 사람을 위한 순서, 잠 안 오는 밤에 갈 수 있는 곳 같은 것들입니다.</li>
      <li>이름 없이 이야기를 남길 수 있는 자리를 둡니다. 오늘 한마디, 그냥 이야기, 혼자 다녀온 곳, 어디 갈까요.</li>
    </ul>

    <h2 id="not">무엇을 하지 않는가</h2>
    <div class="nots">
      <div class="not">${ICON('i-no')}<div><b>관계를 만들어 주지 않습니다</b>매칭도, 소개도, 모임 주선도 하지 않습니다. 혼플은 혼자 나갈 수 있게 돕는 곳이지 누군가를 붙여 주는 곳이 아닙니다.</div></div>
      <div class="not">${ICON('i-lock')}<div><b>이름을 묻지 않습니다</b>가입도 프로필도 없습니다. 글마다 그날의 이름이 하나 붙고, 그 이름은 다음 글에서 바꿔도 됩니다. 쓴 사람을 찾을 수 없다는 것이 이 게시판의 약속입니다.</div></div>
      <div class="not">${ICON('i-mute')}<div><b>등급을 매기지 않습니다</b>각 곳을 검증하거나 점수로 줄 세우지 않습니다. 혼자 지수와 대화 온도는 좋고 나쁨이 아니라 오늘 내 기분에 맞는지를 고르기 위한 표시입니다.</div></div>
    </div>

    <h2 id="index">혼자 지수와 대화 온도</h2>
    <p><b>혼자 지수</b>는 혼자여도 눈에 띄지 않는 정도입니다. 1에 가까울수록 혼자 있는 것이 드러나고, 5에 가까울수록 아무도 신경 쓰지 않습니다. 국밥집이 5라면 네 명짜리 테이블만 있는 고깃집은 2쯤입니다.</p>
    <p><b>대화 온도</b>는 그곳에서 말을 얼마나 하게 되는지입니다. 세 단계로 나눠 두었습니다.</p>
    <ul>
      <li><b>조용히 있어도 됨</b> — 아무 말도 하지 않아도 아무 문제가 없습니다. 도서관, 북바, 영화관.</li>
      <li><b>원하면 한마디</b> — 말을 걸면 받아 주고, 가만히 있으면 내버려 둡니다. 바 좌석이 있는 술집, 동네 단골집.</li>
      <li><b>이야기가 중심</b> — 대화가 전제입니다. 대화형 혼술바, 게스트하우스의 저녁.</li>
    </ul>
    <p>어느 쪽이 낫다는 뜻이 아닙니다. 아무 말도 하기 싫은 날과 몇 마디는 나누고 싶은 날에 맞는 곳이 각각 다르기 때문에 나눠 둔 것입니다.</p>

    <h2 id="why">왜 이름을 묻지 않는가</h2>
    <p>친구에게는 못 하는 말이 있습니다. 말하면 그 말이 관계에 남기 때문입니다. 처음 보는 사람에게는 반대입니다. 말하면 그 자리에서 사라집니다. 혼술바에 가는 사람들이 가장 자주 말하는 만족의 이유가 이것이고, 혼플의 게시판이 이름을 묻지 않는 이유도 같습니다. <a href="/guide/why-anonymous">더 읽기</a></p>

    <h2 id="rules">게시판에서 지켜 주세요</h2>
    <p>이름이 없기 때문에 더 조심해야 하는 것들입니다. 아래에 해당하는 글은 신고가 쌓이면 보이지 않게 되고, 운영자가 확인 후 지웁니다.</p>
    <ul>
      <li>특정인을 알아볼 수 있게 지목하지 않습니다. 실명, 사진 설명, 근무지 같은 것들입니다.</li>
      <li>연락처를 남기거나 요구하지 않습니다. 관계는 여기서만 유지됩니다.</li>
      <li>가게, 서비스, 모임을 홍보하지 않습니다. 다녀온 이야기와 홍보는 다릅니다.</li>
      <li>혐오 표현, 성적인 내용, 자해나 타해를 부추기는 내용을 쓰지 않습니다.</li>
      <li>힘든 밤에 쓴 글은 환영합니다. 다만 지금 당장 위험하다고 느낀다면 자살예방상담전화 109(24시간)로 먼저 연락해 주세요.</li>
    </ul>

    <h2 id="info">플레이스 정보에 대하여</h2>
    <p>플레이스 정보는 공개 자료와 방문자 제보를 바탕으로 합니다. 운영 시간, 가격, 입장 규칙은 자주 바뀌니 방문 전 확인이 필요합니다. 틀린 정보를 발견하면 각 페이지의 ‘정보 수정 제안’으로 알려 주세요. 이름은 묻지 않습니다.</p>

    <div class="form"><div class="submit"><a class="btn" href="/spaces">플레이스 찾기</a><a class="btn ghost" href="/submit">혼자 가기 좋은 곳 알려 주기</a></div></div>
  </article>
</div>
`
}));

write('terms.html', shell({
  path: '/terms', file: 'terms.html', title: '이용약관', desc: `혼플 이용약관 — 서비스의 범위, 플레이스 정보의 성격, 익명 게시물에 관한 규칙과 이용자의 책임을 정리했습니다.`,
  crumbs: [{ name: '이용약관', path: '/terms' }],
  body: `
<article class="prose wrap read">
  <h1>이용약관</h1>
  <p class="small muted">시행일 2026년 (월) (일). 초안이며 법률 검토 후 확정합니다.</p>
  <h2>1. 서비스</h2>
  <p>혼플(이하 ‘서비스’)은 ${BIZ.company}가 운영하며, 혼자 이용할 수 있는 곳과 활동에 대한 정보를 제공하고 이용자가 익명으로 글을 남길 수 있는 게시판을 운영합니다. 서비스는 회원 가입 없이 누구나 이용할 수 있습니다.</p>
  <h2>2. 정보의 성격</h2>
  <p>플레이스 정보는 공개된 자료와 이용자 제보를 바탕으로 작성되며, 운영자는 그 정확성과 최신성을 보증하지 않습니다. 운영 시간, 가격, 입장 조건 등은 방문 전 이용자가 직접 확인해야 합니다. 서비스는 특정 장소의 이용을 권유하거나 보증하지 않으며, 이용 과정에서 발생한 손해에 대해 책임지지 않습니다.</p>
  <h2>3. 게시물</h2>
  <p>이용자는 이름을 밝히지 않고 글을 남길 수 있습니다. 다음에 해당하는 게시물은 예고 없이 숨기거나 삭제할 수 있습니다.</p>
  <ul>
    <li>특정인을 식별할 수 있는 정보를 담거나 명예를 훼손하는 내용</li>
    <li>연락처를 남기거나 요구하는 내용, 만남을 목적으로 하는 내용</li>
    <li>상업적 홍보, 광고, 반복 게시</li>
    <li>혐오 표현, 성적인 내용, 자해·타해를 부추기는 내용</li>
    <li>법령이나 공공질서에 어긋나는 내용</li>
  </ul>
  <p>게시물의 저작권은 작성자에게 있으며, 작성자는 서비스가 게시물을 서비스 내에 게시·보관하는 것을 허락합니다. 익명 게시물의 특성상 작성자 본인 확인이 어려우므로, 게시 후 수정·삭제 요청은 처리하지 못할 수 있습니다.</p>
  <h2>4. 호스트 등록</h2>
  <p>공간을 운영하는 자(이하 ‘호스트’)는 호스트 등록을 신청할 수 있습니다. 등록과 이용에는 비용이 들지 않습니다.</p>
  <ul>
    <li>신청자는 해당 공간을 실제로 운영할 권한이 있어야 하며, 운영자는 사업자등록번호 등으로 이를 확인합니다. 허위 신청이 확인되면 인증을 취소하고 등록을 거부할 수 있습니다.</li>
    <li>인증된 호스트는 자신의 공간 페이지에 공식 안내를 게재하고 운영 정보의 정정을 요청할 수 있으며, 그 공간에 달린 익명 후기에 호스트 표시가 붙은 답글을 남길 수 있습니다.</li>
    <li>호스트가 제공한 정보의 정확성에 대한 책임은 호스트에게 있습니다. 허위·과장 표현, 다른 공간에 대한 비방, 혼자 방문과 무관한 홍보성 내용은 게재를 거부하거나 삭제할 수 있습니다.</li>
    <li><b>호스트 등록은 노출 순서나 평가에 영향을 주지 않습니다.</b> 운영자는 대가를 받고 특정 공간의 노출을 올리거나 평가를 조정하지 않습니다. 혼자 지수와 대화 온도는 호스트 등록 여부와 무관하게 같은 기준으로 적용합니다.</li>
    <li>호스트는 언제든 등록 해지를 요청할 수 있으며, 해지 시 호스트 안내와 수집된 연락처를 삭제합니다.</li>
  </ul>

  <h2>5. 이용자의 책임</h2>
  <p>이용자는 게시물에 대한 법적 책임을 스스로 집니다. 서비스는 이용자 간 분쟁에 개입하지 않습니다.</p>
  <h2>6. 서비스의 변경과 중단</h2>
  <p>운영자는 서비스의 내용을 변경하거나 운영을 중단할 수 있으며, 중요한 변경은 서비스 내에 공지합니다.</p>
  <h2>7. 운영자</h2>
  <p>${BIZ.company} &nbsp;·&nbsp; 대표 ${BIZ.ceo} &nbsp;·&nbsp; 사업자등록번호 ${BIZ.bizNo}<br>${BIZ.addr}<br>문의 <a href="mailto:${BIZ.email}">${BIZ.email}</a></p>

  <h2>8. 준거법</h2>
  <p>이 약관은 대한민국 법률에 따릅니다. 서비스 이용과 관련한 분쟁은 운영자의 주소지를 관할하는 법원을 전속 관할로 합니다.</p>
</article>
`
}));

write('privacy.html', shell({
  path: '/privacy', file: 'privacy.html', title: '개인정보처리방침',
  desc: `혼플의 개인정보처리방침 — 일반 이용자에게는 개인정보를 요구하지 않으며, 호스트 등록 신청에 한해 수집하는 항목과 목적, 보유 기간을 정리했습니다.`,
  crumbs: [{ name: '개인정보처리방침', path: '/privacy' }],
  body: `
<article class="prose wrap read">
  <h1>개인정보처리방침</h1>
  <p class="small muted">시행일 2026년 (월) (일). 초안이며 법률 검토 후 확정합니다. 운영자 ${BIZ.company}(이하 ‘회사’)는 아래와 같이 개인정보를 처리합니다.</p>

  <h2>1. 일반 이용자에게는 개인정보를 요구하지 않습니다</h2>
  <p>플레이스를 찾아보고, 글을 읽고, 익명 게시판에 글을 남기는 데는 회원 가입이 필요하지 않습니다. 이름·이메일·전화번호·프로필을 요구하지 않습니다. 게시물에 붙는 이름은 이용자의 기기에서 무작위로 만들어지는 임시 이름이며 특정 개인과 연결되지 않습니다.</p>

  <h2>2. 호스트 등록 신청 시 수집하는 개인정보</h2>
  <p>공간 운영자가 <a href="/host">호스트 등록</a>을 신청하는 경우에 한해 아래 정보를 수집합니다. 신청은 선택이며, 신청하지 않으면 수집하지 않습니다.</p>
  <table class="pv-table">
    <thead><tr><th>구분</th><th>항목</th><th>목적</th><th>보유 기간</th></tr></thead>
    <tbody>
      <tr><td>필수</td><td>담당자 이름, 이메일, 사업자등록번호</td><td>호스트 자격 확인, 심사 결과 회신</td><td>인증 해지 또는 삭제 요청 시까지</td></tr>
      <tr><td>선택</td><td>전화번호, 홈페이지·SNS 주소</td><td>확인 과정의 연락</td><td>인증 해지 또는 삭제 요청 시까지</td></tr>
      <tr><td>자동</td><td>접속 IP의 해시값</td><td>중복·악용 신청 방지</td><td>수집 시점부터 최대 6개월</td></tr>
    </tbody>
  </table>
  <p>공간 이름·주소·운영 정보 등 공간에 관한 내용은 개인정보가 아니며, 인증 후 사이트에 공개될 수 있습니다. <b>담당자 이름·연락처·사업자등록번호는 사이트에 공개하지 않습니다.</b></p>
  <p>이용자는 개인정보 수집·이용에 동의하지 않을 권리가 있습니다. 다만 필수 항목에 동의하지 않으면 호스트 등록 심사가 어렵습니다.</p>

  <h2>3. 게시판 운영을 위해 처리하는 정보</h2>
  <ul>
    <li>게시물 내용, 게시 시각, 임시 이름은 게시판 운영을 위해 저장합니다.</li>
    <li>접속 IP를 복원할 수 없는 형태(해시)로 변환한 값은 도배와 악용을 막기 위한 목적으로만 보관하며, 원래 IP는 저장하지 않습니다.</li>
    <li>기기에 저장되는 정보(localStorage)인 임시 이름, 반응 기록 등은 이용자의 브라우저에만 저장되며 서버로 전송되지 않습니다. 브라우저 데이터를 지우면 함께 삭제됩니다.</li>
  </ul>

  <h2>4. 제3자 제공과 처리 위탁</h2>
  <p>회사는 수집한 개인정보를 제3자에게 제공하지 않습니다. 다만 서비스 운영을 위해 아래와 같이 처리를 위탁하고 있습니다.</p>
  <ul>
    <li><b>Cloudflare, Inc.</b> — 웹사이트 호스팅과 데이터 보관. 데이터는 국외 서버에 저장될 수 있습니다.</li>
  </ul>
  <p>웹 글꼴은 외부 CDN에서 불러오며, 지도 보기는 외부 지도 서비스로 연결됩니다. 각 서비스의 개인정보 처리는 해당 서비스의 방침을 따릅니다. 광고 추적 도구는 사용하지 않습니다.</p>

  <h2>5. 파기</h2>
  <p>보유 기간이 지나거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자적 파일은 복구할 수 없는 방법으로 삭제합니다.</p>

  <h2>6. 이용자의 권리</h2>
  <p>이용자는 자신의 개인정보에 대해 열람·정정·삭제·처리정지를 요구할 수 있습니다. 아래 문의처로 연락하시면 지체 없이 처리합니다. 다만 익명 게시물은 작성자 확인이 어려워 요청을 처리하지 못할 수 있습니다.</p>

  <h2>7. 안전조치</h2>
  <p>개인정보에 접근할 수 있는 인원을 최소한으로 제한하고, 전송 구간은 암호화(HTTPS)하며, 접속 IP는 복원할 수 없는 해시로만 보관합니다.</p>

  <h2>8. 아동의 이용</h2>
  <p>혼플은 주류 관련 장소 정보를 포함하므로 만 19세 미만의 이용을 권장하지 않습니다. 만 14세 미만 아동의 개인정보는 수집하지 않습니다.</p>

  <h2>9. 개인정보보호책임자</h2>
  <p>성명 ${BIZ.privacyOfficer}<br>
  소속 ${BIZ.company}<br>
  이메일 <a href="mailto:${BIZ.email}">${BIZ.email}</a>${BIZ.phone ? `<br>전화 ${BIZ.phone}` : ''}</p>
  <p>개인정보 침해에 대한 신고나 상담이 필요하시면 개인정보침해신고센터(privacy.kisa.or.kr, 118), 개인정보분쟁조정위원회(kopico.go.kr, 1833-6972), 대검찰청 사이버수사과(1301), 경찰청 사이버수사국(182)으로 문의하실 수 있습니다.</p>

  <h2>10. 방침의 변경</h2>
  <p>이 방침이 변경되는 경우 시행 7일 전부터 사이트에 공지합니다. 다만 이용자 권리에 중대한 영향을 주는 변경은 30일 전에 공지합니다.</p>
</article>
`
}));

write('404.html', shell({
  path: '/404', file: '404.html', title: '찾는 곳이 없어요', desc: '찾으시는 페이지가 없거나 주소가 바뀌었습니다. 플레이스 목록이나 매거진에서 다시 찾아보세요.', noTab: true, noIndex: true,
  body: `
<div class="wrap read nf">
  <h1>이 곳은 비어 있어요.</h1>
  <p>찾으시는 페이지가 없거나 주소가 바뀌었습니다.</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="/">처음으로</a><a class="btn ghost" href="/spaces">플레이스 찾기</a><a class="btn ghost" href="/magazine">매거진</a></div>
</div>
`
}));

/* 옛 주소 호환: /space.html?id=xxx → /place/xxx */
write('space.html', shell({
  path: '/space', file: 'space.html', title: '이동 중', desc: '플레이스 페이지로 이동합니다', noIndex: true, noTab: true,
  head: `<script>(function(){var id=new URLSearchParams(location.search).get('id');location.replace(id?'/place/'+encodeURIComponent(id):'/spaces');})();</script>`,
  body: `<div class="wrap read nf"><h1>이동 중입니다</h1><p><a href="/spaces">플레이스 목록으로</a></p></div>`
}));

/* 관리자 */
write('admin.html', shell({
  path: '/admin', file: 'admin.html', title: '관리자', desc: '혼플 운영 관리 화면입니다. 검색에 노출되지 않습니다.', noIndex: true, noTab: true,
  scripts: ['admin.js'],
  body: `
<div class="wrap admin" data-admin>
  <div class="sk">불러오는 중</div>
</div>
`
}));

/* ══════════════════════════════════════════
   9. sitemap · rss · robots
   ══════════════════════════════════════════ */
{
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', pri: '1.0', freq: 'daily' },
    { loc: '/spaces', pri: '0.9', freq: 'daily' },
    { loc: '/magazine', pri: '0.8', freq: 'weekly' },
    { loc: '/guide', pri: '0.8', freq: 'weekly' },
    { loc: '/board', pri: '0.7', freq: 'daily' },
    { loc: '/about', pri: '0.5', freq: 'monthly' },
    { loc: '/host', pri: '0.6', freq: 'monthly' },
    { loc: '/submit', pri: '0.4', freq: 'monthly' },
    { loc: '/terms', pri: '0.2', freq: 'yearly' },
    { loc: '/privacy', pri: '0.2', freq: 'yearly' },
    ...categories.filter((c) => spaces.some((s) => s.cat === c.id)).map((c) => ({ loc: `/c/${c.id}`, pri: '0.8', freq: 'weekly' })),
    ...areas.map((a) => ({ loc: `/area/${a.slug}`, pri: '0.7', freq: 'weekly' })),
    ...spaces.map((s) => ({ loc: placeUrl(s.id), pri: '0.7', freq: 'monthly' })),
    ...guides.map((g) => ({ loc: `/guide/${g.id}`, pri: '0.6', freq: 'monthly' })),
    ...articles.map((a) => ({ loc: `/magazine/${a.id}`, pri: '0.7', freq: 'monthly', date: a.date }))
  ];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u.loc}</loc><lastmod>${u.date || today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>
`);

  write('robots.txt', `User-agent: *
Allow: /
Disallow: /admin
Disallow: /space.html

# 네이버
User-agent: Yeti
Allow: /

# 구글
User-agent: Googlebot
Allow: /

# 다음
User-agent: Daum
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);

  const rssDate = (d) => new Date(d + 'T09:00:00+09:00').toUTCString();
  write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${BRAND} 매거진</title>
  <link>${SITE}/magazine</link>
  <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>
  <description>혼자 보내는 시간에 대해 쓴 글들</description>
  <language>ko</language>
  <lastBuildDate>${rssDate(articles[0].date)}</lastBuildDate>
${articles.map((a) => `  <item>
    <title>${esc(a.title)}</title>
    <link>${SITE}/magazine/${a.id}</link>
    <guid isPermaLink="true">${SITE}/magazine/${a.id}</guid>
    <pubDate>${rssDate(a.date)}</pubDate>
    <description>${esc(a.lead)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`);

  /* /space 는 리다이렉트하지 않습니다. space.html 이 ?id= 를 읽어
     /place/<id> 로 보내 주어야 옛 주소가 살아납니다. */
  /* pages.dev 로 들어온 접속은 정식 도메인으로 보냅니다.
     같은 내용이 두 주소로 열리면 검색엔진이 중복으로 보기 때문입니다.
     (honplace.com 요청은 아래 규칙에 걸리지 않으므로 무한 반복이 생기지 않습니다.) */
  write('_redirects', `https://honplace.pages.dev/*  ${SITE}/:splat  301
/places  /spaces  301
/places.html  /spaces  301
`);
}

/* ══════════════════════════════════════════
   10. 정리 — 더 이상 생성되지 않는 페이지 삭제
   데이터에서 항목을 지우면(폐업 등) 그 페이지가 남아 계속 서비스되는 것을 막습니다.
   아래 폴더만 건드리며, 그 밖의 파일은 손대지 않습니다.
   ══════════════════════════════════════════ */
{
  const managed = ['place', 'c', 'area', 'guide', 'magazine'];
  const keep = new Set(written.map((f) => f.replace(/\\/g, '/')));
  const removed = [];
  for (const dir of managed) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full)) {
      if (!name.endsWith('.html')) continue;
      const rel = `${dir}/${name}`;
      if (keep.has(rel)) continue;
      fs.unlinkSync(path.join(ROOT, rel));
      removed.push(rel);
    }
  }
  if (removed.length) console.log(`정리 — 삭제된 페이지 ${removed.length}개: ${removed.join(', ')}`);
}

console.log(`생성 완료 — ${written.length}개 파일`);
console.log(`  플레이스 ${spaces.length} · 카테고리 ${categories.length} · 지역 ${areas.length} · 가이드 ${guides.length} · 매거진 ${articles.length}`);
