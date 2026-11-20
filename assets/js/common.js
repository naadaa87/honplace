/* 혼플 common.js */
(function () {
  const H = {};
  window.H = H;

  /* ── 기본 유틸 ─────────────────────────── */
  H.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  H.qs = (sel, root = document) => root.querySelector(sel);
  H.qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  H.param = (k) => new URLSearchParams(location.search).get(k);
  H.icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="/assets/img/icons.svg#${id}"></use></svg>`;
  H.uid = (p = 'local') => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  H.fmtTime = (iso) => {
    const d = new Date(iso); const now = new Date();
    const diff = (now - d) / 1000;
    if (isNaN(diff)) return '';
    if (diff < 60) return '방금';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    if (diff < 172800) return '어제';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + '일 전';
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  };

  H.seats = (n, lg = false) => {
    let s = `<span class="seats${lg ? ' lg' : ''}" role="img" aria-label="혼자 지수 5점 중 ${n}점">`;
    for (let i = 1; i <= 5; i++) s += `<i class="${i <= n ? 'on' : ''}"></i>`;
    return s + '</span>';
  };
  H.dots = H.seats;
  H.TALK = ['조용히 있어도 됨', '원하면 한마디', '이야기가 중심'];
  H.TALK_SHORT = ['조용히', '원하면 한마디', '이야기 중심'];
  H.talk = (lv, short = false) => `<span class="talk t${lv}">${short ? H.TALK_SHORT[lv] : H.TALK[lv]}</span>`;
  H.TIME = { day: '낮', evening: '저녁', night: '밤늦게' };
  H.CATS = {}; // filled by loadSpaces

  H.toast = (msg) => {
    let t = H.qs('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2200);
  };

  /* ── 정적 데이터 ───────────────────────── */
  const cache = {};
  H.loadSpaces = async () => {
    if (cache.spaces) return cache.spaces;
    const r = await fetch('/data/spaces.json', { cache: 'no-cache' });
    const j = await r.json();
    j.categories.forEach((c) => (H.CATS[c.id] = c));
    cache.spaces = j; return j;
  };
  H.loadGuides = async () => {
    if (cache.guides) return cache.guides;
    const r = await fetch('/data/guides.json', { cache: 'no-cache' });
    cache.guides = await r.json(); return cache.guides;
  };
  H.spaceRow = (s, opts = {}) => {
    const c = H.CATS[s.cat] || {};
    const time = s.time.map((t) => H.TIME[t]).join(', ');
    return `<a class="row" href="/place/${encodeURIComponent(s.id)}">
      <div class="c1">${H.seats(s.solo)}</div>
      <div class="c2">
        <div class="name">${H.esc(s.name)}${s.kind === 'type' ? '<span class="tag kind">유형</span>' : ''}</div>
        <div class="area">${H.esc(s.area)}${opts.cat !== false ? `<span class="cat">${H.esc(c.label || '')}</span>` : ''}</div>
        ${opts.intro === false ? '' : `<p class="intro">${H.esc(s.intro)}</p>`}
      </div>
      <div class="meta">${H.talk(s.talk, true)}<span class="num">${H.esc(s.price)}</span><span>${time}</span></div>
    </a>`;
  };
  H.sheetHead = () => `<div class="thead"><span>혼자 지수</span><span>어떤 곳</span><span>대화</span><span>비용</span><span>시간</span></div>`;

  /* 지금 시각 */
  H.now = () => {
    const d = new Date(); const h = d.getHours();
    const day = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    const period = h >= 5 && h < 11 ? '아침' : h < 17 ? '낮' : h < 22 ? '저녁' : '밤';
    const slot = h >= 5 && h < 17 ? 'day' : h < 22 ? 'evening' : 'night';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { day, period, slot, h, label: `${day}요일 ${period} ${h12}시` };
  };

  /* ── 익명 이름 ─────────────────────────── */
  const ADJ = ['조용한', '느린', '밤의', '창가의', '새벽의', '비 오는 날의', '걷는', '앉아 있는', '늦은', '이른', '말 없는', '오늘의', '지나가는', '남은', '첫 번째', '세 번째', '구석의', '골목의', '흐린', '맑은', '반쯤 남은', '돌아오는'];
  const NOUN = ['고양이', '고래', '여우', '국밥', '창가', '벤치', '계단', '등불', '라디오', '우산', '가로등', '유리잔', '커피', '페이지', '의자', '손님', '걸음', '목요일', '반달', '열차', '골목', '자리'];
  H.nick = {
    make() { return ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)]; },
    get() { let n = localStorage.getItem('hj_nick'); if (!n) { n = this.make(); localStorage.setItem('hj_nick', n); } return n; },
    regen() { const n = this.make(); localStorage.setItem('hj_nick', n); return n; }
  };

  /* ── API 클라이언트 (D1 연결 전에는 체험 모드) ── */
  const LS_POSTS = 'hj_posts', LS_REACTS = 'hj_reacts';
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  let readyPromise = null;
  H.api = {
    demo: false,
    async ready() {
      if (readyPromise) return readyPromise;
      readyPromise = (async () => {
        try {
          const r = await fetch('/api/health', { cache: 'no-store' });
          if (!r.ok) throw 0;
          const j = await r.json();
          H.api.demo = !j.ready; return j.ready;
        } catch { H.api.demo = true; return false; }
      })();
      return readyPromise;
    },
    async _json(url, opt) {
      const r = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opt));
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || '요청에 실패했습니다');
      return j;
    },

    /* 목록 */
    async listPosts({ category = '', space = '', limit = 30 } = {}) {
      const live = await this.ready();
      if (live) {
        const q = new URLSearchParams({ category, space, limit });
        return (await this._json('/api/posts?' + q)).posts;
      }
      const seed = (await (await fetch('/data/seed-posts.json')).json()).posts;
      const local = lsGet(LS_POSTS, []);
      let all = [...local, ...seed];
      if (category) all = all.filter((p) => p.category === category);
      if (space) all = all.filter((p) => p.space_id === space);
      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return all.slice(0, limit);
    },
    async getPost(id) {
      const live = await this.ready();
      if (live) return (await this._json('/api/posts/' + encodeURIComponent(id))).post;
      const all = await this.listPosts({ limit: 999 });
      return all.find((p) => p.id === id) || null;
    },
    async createPost(data) {
      const live = await this.ready();
      if (live) return (await this._json('/api/posts', { method: 'POST', body: JSON.stringify(data) })).post;
      const p = Object.assign({ id: H.uid(), metoo: 0, thanks: 0, going: 0, comments: 0, replies: [], created_at: new Date().toISOString() }, data);
      const local = lsGet(LS_POSTS, []); local.unshift(p); lsSet(LS_POSTS, local); return p;
    },
    async react(id, type) {
      const reacts = lsGet(LS_REACTS, {});
      const key = id + ':' + type;
      if (reacts[key]) return { already: true };
      reacts[key] = 1; lsSet(LS_REACTS, reacts);
      const live = await this.ready();
      if (live) return this._json('/api/posts/' + encodeURIComponent(id) + '/react', { method: 'POST', body: JSON.stringify({ type }) });
      const local = lsGet(LS_POSTS, []); const p = local.find((x) => x.id === id);
      if (p) { p[type] = (p[type] || 0) + 1; lsSet(LS_POSTS, local); }
      return { ok: true };
    },
    reacted(id, type) { return !!lsGet(LS_REACTS, {})[id + ':' + type]; },
    async comment(id, data) {
      const live = await this.ready();
      if (live) return (await this._json('/api/posts/' + encodeURIComponent(id) + '/comments', { method: 'POST', body: JSON.stringify(data) })).comment;
      const c = Object.assign({ id: H.uid('c'), created_at: new Date().toISOString() }, data);
      const local = lsGet(LS_POSTS, []); const p = local.find((x) => x.id === id);
      if (p) { p.replies = p.replies || []; p.replies.push(c); p.comments = p.replies.length; lsSet(LS_POSTS, local); }
      else { const extra = lsGet('hj_seed_replies', {}); (extra[id] = extra[id] || []).push(c); lsSet('hj_seed_replies', extra); }
      return c;
    },
    seedReplies(id) { return lsGet('hj_seed_replies', {})[id] || []; },
    async report(id) {
      const live = await this.ready();
      if (live) return this._json('/api/posts/' + encodeURIComponent(id) + '/report', { method: 'POST', body: '{}' });
      return { ok: true };
    },
    async submitSpace(data) {
      const live = await this.ready();
      if (live) return this._json('/api/submit', { method: 'POST', body: JSON.stringify(data) });
      const q = lsGet('hj_submissions', []); q.push(Object.assign({ created_at: new Date().toISOString() }, data)); lsSet('hj_submissions', q);
      return { ok: true, demo: true };
    }
  };

  /* ── 사진 카드 ─────────────────────────────
     고정 사진은 /data/photos.json, 관리자·호스트가 올린 사진은 /api/photos/covers 에서 옵니다.
     사진이 없는 곳은 '한 줄에 늘어선 자리' 표지를 씁니다. */
  H.bench = (n) => `<span class="bench" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i${n >= i ? ' class="on"' : ''}></i>`).join('')}</span>`;
  const IMG_ERR = "this.parentNode.classList.remove('has');this.remove()";
  H.coverInner = (cat, solo, tags = []) => `<span class="cv-tags" aria-hidden="true">${tags.map((t) => `<span>${H.esc(t)}</span>`).join('')}</span>${H.icon('cat-' + cat)}${H.bench(solo)}`;
  H.coverHtml = (s, src) => `<span class="pc-media${src ? ' has' : ''}" data-cover><span class="pc-ph">${H.coverInner(s.cat, s.solo, (s.tags || []).slice(0, 2))}</span>${src ? `<img src="${H.esc(src)}" alt="${H.esc(s.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="${IMG_ERR}">` : ''}</span>`;
  H.spaceCard = (s, covers = {}, opts = {}) => {
    const c = H.CATS[s.cat] || {};
    return `<a class="pc" href="/place/${encodeURIComponent(s.id)}" data-id="${H.esc(s.id)}">
      ${H.coverHtml(s, covers[s.id])}
      <span class="pc-body">
        <span class="pc-top"><span>${H.esc(s.area)}</span>${opts.cat === false ? '' : `<span class="pc-cat">${H.esc(c.label || '')}</span>`}</span>
        <b class="pc-name">${H.esc(s.name)}${s.kind === 'type' ? '<span class="tag kind">유형</span>' : ''}</b>
        <span class="pc-intro">${H.esc(s.intro)}</span>
        <span class="pc-facts">${H.seats(s.solo)}${H.talk(s.talk, true)}<span class="num">${H.esc(s.price)}</span></span>
      </span>
    </a>`;
  };
  /* 올린 사진의 대표 그림 — 한 번 받아 오면 10분 동안 다시 묻지 않습니다 */
  let dynP = null;
  H.dynCovers = () => dynP || (dynP = (async () => {
    try { const c = JSON.parse(sessionStorage.getItem('hp_covers') || 'null'); if (c && Date.now() - c.t < 600000) return c.v; } catch { /* */ }
    let v = {};
    try { const r = await fetch('/api/photos/covers'); if (r.ok) v = (await r.json()).covers || {}; } catch { /* */ }
    try { sessionStorage.setItem('hp_covers', JSON.stringify({ t: Date.now(), v })); } catch { /* */ }
    return v;
  })());
  let allP = null;
  H.loadCovers = () => allP || (allP = (async () => {
    const out = {};
    try {
      const j = await fetch('/data/photos.json').then((r) => r.json());
      Object.entries(j.photos || {}).forEach(([id, ps]) => { if (ps && ps[0] && ps[0].src) out[id] = ps[0].thumb || ps[0].src; });
    } catch { /* */ }
    return Object.assign(out, await H.dynCovers());
  })());
  /* 이미 그려진 카드에 올린 사진을 끼워 넣습니다 */
  H.hydrateCovers = async (root = document) => {
    const cards = H.qsa('.pc[data-id]', root);
    if (!cards.length) return;
    const dyn = await H.dynCovers();
    cards.forEach((a) => {
      const src = dyn[a.dataset.id]; if (!src) return;
      const m = a.querySelector('[data-cover]'); if (!m) return;
      const old = m.querySelector('img');
      if (old && old.getAttribute('src') === src) return;
      if (old) old.remove();
      m.classList.add('has');
      m.insertAdjacentHTML('beforeend', `<img src="${H.esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="${IMG_ERR}">`);
    });
  };

  /* ── 방문 통계 ─────────────────────────────
     관리자 KPI용. 이름·연락처는 보내지 않고, 이 브라우저에서 만든 무작위 id 로만 방문자를 구분합니다.
     관리자 화면에서 '내 방문 제외'를 켜면 이 브라우저의 기록은 보내지 않습니다. */
  const rid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 16);
  const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* */ } } };
  let firstVisit = false;
  H.vid = () => {
    let v = ls.get('hp_vid');
    if (!v || !/^[a-z0-9]{6,24}$/.test(v)) { v = rid(); ls.set('hp_vid', v); firstVisit = true; }
    return v;
  };
  H.track = () => {};
  (function tracker() {
    const path = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') || '/';
    if (/^\/admin/.test(path)) return;
    /* 브라우저에서 '추적 안 함(DNT)'이나 GPC 를 켠 경우에도 보내지 않습니다 */
    let off = ls.get('hp_notrack') === '1' || navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
    try { off = off || sessionStorage.getItem('hp_t_off') === '1'; } catch { /* */ }
    if (off) return;

    const vid = H.vid();
    /* 방문(세션): 30분 동안 움직임이 없으면 새 방문 */
    let sess = null; try { sess = JSON.parse(ls.get('hp_sess') || 'null'); } catch { /* */ }
    const t0 = Date.now();
    const entry = !sess || !sess.id || t0 - (sess.t || 0) > 30 * 60 * 1000;
    if (entry) sess = { id: rid(), t: t0 };
    const touch = () => { sess.t = Date.now(); ls.set('hp_sess', JSON.stringify(sess)); };
    touch();

    const kind = path === '/' ? 'home'
      : /^\/place\//.test(path) ? 'place' : /^\/c\//.test(path) ? 'cat' : /^\/area\//.test(path) ? 'area'
      : /^\/guide/.test(path) ? 'guide' : /^\/magazine/.test(path) ? 'magazine' : /^\/test/.test(path) ? 'test'
      : /^\/board/.test(path) ? 'board' : /^\/spaces/.test(path) ? 'spaces' : /^\/host\/center/.test(path) ? 'hostcenter'
      : /^\/host/.test(path) ? 'host' : /^\/submit/.test(path) ? 'submit' : 'etc';
    const sp = (document.querySelector('[data-space-id]') || {}).dataset?.spaceId || '';

    /* 어디서 왔나: 검색·SNS·외부 링크·직접·캠페인(utm) */
    let rt = 'direct', rh = '', kw = '';
    const qp = new URLSearchParams(location.search);
    if (qp.get('utm_source')) { rt = 'campaign'; rh = qp.get('utm_source'); kw = qp.get('utm_campaign') || ''; }
    else if (document.referrer) {
      try {
        const r = new URL(document.referrer);
        const h = r.hostname.replace(/^(www|m)\./, '');
        if (r.hostname === location.hostname) rt = 'internal';
        else if (/(^|\.)search\.naver\.com$/.test(h) || h === 'naver.com') { rt = 'search'; rh = 'naver'; kw = r.searchParams.get('query') || ''; }
        else if (/(^|\.)google\.[a-z.]+$/.test(h)) { rt = 'search'; rh = 'google'; kw = r.searchParams.get('q') || ''; }
        else if (/(^|\.)(daum\.net|search\.daum\.net)$/.test(h)) { rt = 'search'; rh = 'daum'; kw = r.searchParams.get('q') || ''; }
        else if (/(^|\.)bing\.com$/.test(h)) { rt = 'search'; rh = 'bing'; kw = r.searchParams.get('q') || ''; }
        else if (/(^|\.)(zum\.com|duckduckgo\.com|yahoo\.com|ecosia\.org)$/.test(h)) { rt = 'search'; rh = h.split('.').slice(-2, -1)[0]; }
        else if (/(^|\.)(instagram\.com|facebook\.com|threads\.net|x\.com|twitter\.com|t\.co|youtube\.com|kakao\.com|band\.us|blog\.naver\.com|cafe\.naver\.com|tistory\.com|brunch\.co\.kr)$/.test(h)) {
          rt = 'social'; rh = h.replace(/^(l|lm)\./, '');
        } else { rt = 'ref'; rh = h; }
      } catch { /* */ }
    }
    const ua = navigator.userAgent;
    const dv = /iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';

    let dead = false;
    const beacon = (o) => {
      if (dead) return;
      const body = JSON.stringify(o);
      try { if (navigator.sendBeacon && navigator.sendBeacon('/api/t', new Blob([body], { type: 'application/json' }))) return; } catch { /* */ }
      fetch('/api/t', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
    };

    /* 페이지 조회 — DB가 없으면(503) 이번 방문 동안은 더 보내지 않습니다 */
    let pvid = rid();
    const sendPv = (isEntry, isNew) => fetch('/api/t', {
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: 'pv', id: pvid, vid, sid: sess.id, path, kind, sp, rt: isEntry ? rt : 'internal', rh: isEntry ? rh : '', kw: isEntry ? kw : '', dv, nw: isNew ? 1 : 0, en: isEntry ? 1 : 0 })
    }).then((r) => { if (r.status === 503) { dead = true; try { sessionStorage.setItem('hp_t_off', '1'); } catch { /* */ } } }).catch(() => {});
    sendPv(entry, firstVisit);

    /* 체류시간 — 화면이 보이는 동안만 셉니다 */
    let acc = 0, since = document.visibilityState === 'visible' ? performance.now() : 0, sent = 0;
    const flush = () => {
      if (since) { acc += performance.now() - since; since = 0; }
      const ms = Math.round(acc);
      if (ms - sent >= 1000) { sent = ms; beacon({ t: 'dw', id: pvid, vid, ms }); }
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
      else { since = performance.now(); touch(); }
    });
    addEventListener('pagehide', flush);
    /* 뒤로 가기로 돌아온 경우(bfcache)는 새 조회로 셉니다 */
    addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      pvid = rid(); acc = 0; sent = 0; since = performance.now();
      const idle = Date.now() - (sess.t || 0) > 30 * 60 * 1000;
      if (idle) sess = { id: rid(), t: Date.now() };
      touch(); sendPv(idle, false);
    });

    /* 클릭·행동 */
    H.track = (type, label = '') => {
      if (!type) return;
      touch();
      beacon({ t: 'ev', vid, sid: sess.id, path, sp, type, label: String(label || '').slice(0, 80) });
    };
    document.addEventListener('click', (e) => {
      const el = e.target.closest('a[href], [data-track]');
      if (!el) return;
      if (el.dataset.track) return H.track(el.dataset.track, el.dataset.trackLabel || '');
      let u; try { u = new URL(el.href, location.href); } catch { return; }
      if (u.protocol === 'mailto:') return H.track('mail', u.pathname.split('@')[1] || '');
      if (u.protocol === 'tel:') return H.track('out', 'tel');
      if (u.hostname === location.hostname) return;
      const h = u.hostname.replace(/^www\./, '');
      if (/(^|\.)map\.naver\.com$/.test(h) || h === 'naver.me') return H.track('map', 'naver');
      if (/(^|\.)google\.[a-z.]+$/.test(h) && /^\/maps/.test(u.pathname)) return H.track('map', 'google');
      if (/(^|\.)map\.kakao\.com$/.test(h) || h === 'kko.to') return H.track('map', 'kakao');
      H.track('out', h);
    }, true);
  })();

  /* ── 공통 UI ───────────────────────────── */
  H.CAT_LABEL = { today: '오늘 한마디', story: '그냥 이야기', review: '다녀왔어요', ask: '어디 갈까요' };

  H.demoNotice = () => `<div class="notice">${H.icon('i-info')}<div>지금은 체험 모드입니다. 여기서 쓴 글과 반응은 이 기기에만 저장되고 다른 사람에게는 보이지 않습니다. 데이터베이스가 연결되면 바로 함께 쓰는 게시판이 됩니다.</div></div>`;

  document.addEventListener('DOMContentLoaded', () => {
    // 현재 페이지 표시
    const path = location.pathname.replace(/\/index\.html$/, '/');
    H.qsa('.nav a, .tabbar a').forEach((a) => {
      const href = a.getAttribute('href');
      const key = href.replace(/\.html$/, '');
      const cur = path.replace(/\.html$/, '');
      if ((key === '/' && (cur === '/' || cur === '')) || (key !== '/' && cur.startsWith(key))) a.setAttribute('aria-current', 'page');
    });
    // 정적으로 그려진 카드에 올린 사진 끼워 넣기
    H.hydrateCovers();
  });
})();
