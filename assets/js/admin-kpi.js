/* 혼플 admin-kpi.js — 관리자 KPI 탭
   데이터: GET /api/admin?what=kpi (functions/api/admin/_kpi.js)
   방문 기록은 common.js 의 수집기가 /api/t 로 보낸 것입니다. */
(function () {
  const KPI = {};
  window.HPKPI = KPI;

  /* ── 이름표 ──────────────────────────── */
  const KIND = { home: '홈', place: '플레이스', cat: '분류', area: '동네', guide: '혼자 하는 법', magazine: '매거진', test: '혼자력 테스트', board: '게시판', spaces: '플레이스 목록', host: '호스트 등록', hostcenter: '호스트센터', submit: '제보', etc: '기타' };
  const AREA = { 'seoul-mapo': '마포·홍대·연남', 'seoul-jung': '을지로·중구·종로', 'seoul-seongdong': '성수·성동', 'seoul-yongsan': '용산·삼각지·이태원', 'seoul-gangnam': '강남·서초·송파', 'seoul-gwanak': '관악·동작·서울대입구', 'seoul-yeongdeungpo': '영등포·문래·여의도', 'seoul-seodaemun': '서대문·연희·신촌', 'seoul-etc': '서울 그 밖', busan: '부산', daegu: '대구', incheon: '인천', daejeon: '대전', gwangju: '광주', jeju: '제주', gyeonggi: '경기·수도권' };
  const STATIC = { '/': '홈', '/spaces': '플레이스 전체', '/board': '이름 없는 이야기', '/guide': '혼자 하는 법 목차', '/guide/': '혼자 하는 법 목차', '/magazine': '매거진 목차', '/magazine/': '매거진 목차', '/test': '혼자력 테스트', '/test/': '혼자력 테스트', '/host': '호스트 등록', '/host/': '호스트 등록', '/host/center': '호스트센터', '/submit': '플레이스 알려 주기', '/about': '소개', '/privacy': '개인정보처리방침', '/terms': '이용약관', '/rules': '게시판 규칙', '/404': '없는 페이지' };
  const STATUS = { new: '접수', reviewing: '확인 중', verified: '인증', rejected: '반려' };
  const CTA = { 'header-write': '상단 ‘한마디 남기기’', 'today-pick': '홈 ‘오늘의 혼플’', 'today-q': '게시판 ‘오늘의 질문’ 답하기', 'place-host': '플레이스 → 호스트 안내', 'home-test': '홈 → 혼자력 테스트' };
  const MAPS = { naver: '네이버지도', google: '구글지도', kakao: '카카오맵' };
  const POSTCAT = { today: '오늘 한마디', story: '그냥 이야기', review: '다녀왔어요', ask: '어디 갈까요' };
  const evName = (type, label) => ({
    map: `지도 열기 — ${MAPS[label] || label || '기타'}`,
    out: `외부 링크 — ${label || ''}`,
    mail: '메일 링크',
    like: '가고 싶어요', unlike: '가고 싶어요 취소',
    share: '공유',
    search: '목록 검색', filter: '목록 필터',
    test_start: '테스트 시작', test_result: '테스트 완료',
    post: `글 올림${label ? ' — ' + (POSTCAT[label] || label) : ''}`,
    host_apply: '호스트 신청', submit: '플레이스 제보',
    cta: `버튼 — ${CTA[label] || label || ''}`
  }[type] || type);
  const refName = (t, h) => t === 'search' ? (h === 'naver' ? '네이버 검색' : h === 'google' ? '구글 검색' : `${h || '기타'} 검색`)
    : t === 'social' ? 'SNS·블로그' : t === 'ref' ? '외부 링크' : t === 'campaign' ? '캠페인(utm)' : t === 'internal' ? '사이트 안' : '직접 방문';
  const refGroup = (t, h) => t === 'search' ? (h === 'naver' ? '네이버 검색' : h === 'google' ? '구글 검색' : '기타 검색') : refName(t, h);

  /* ── 형식 ────────────────────────────── */
  const esc = (s) => H.esc(s);
  const n = (v) => (Number(v) || 0).toLocaleString('ko-KR');
  const pct = (v, d = 1) => (v == null || !isFinite(v) ? '—' : (v * 100).toFixed(d) + '%');
  const dur = (ms) => {
    ms = Math.round(ms || 0);
    if (!ms) return '—';
    const s = Math.round(ms / 1000);
    if (s < 60) return s + '초';
    const m = Math.floor(s / 60), r = s % 60;
    return m + '분' + (r ? ' ' + r + '초' : '');
  };
  const md = (d) => { const [, m, dd] = d.split('-'); return `${+m}월 ${+dd}일`; };
  const wdName = ['일', '월', '화', '수', '목', '금', '토'];

  /* 증감: 같은 길이의 직전 기간과 비교. down=true 면 줄어드는 쪽이 좋은 지표(이탈률) */
  function delta(cur, prev, { down = false, ratio = false } = {}) {
    if (prev == null) return '';
    if (ratio) {
      const diff = (cur - prev) * 100;
      if (!prev && !cur) return '<span class="kp-d flat">변화 없음</span>';
      if (Math.abs(diff) < 0.05) return '<span class="kp-d flat">— 변화 없음</span>';
      const good = down ? diff < 0 : diff > 0;
      return `<span class="kp-d ${good ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}%p</span>`;
    }
    if (!prev) return cur ? '<span class="kp-d new">직전 기간 0</span>' : '<span class="kp-d flat">변화 없음</span>';
    const r = (cur - prev) / prev;
    if (Math.abs(r) < 0.0005) return '<span class="kp-d flat">— 변화 없음</span>';
    const good = down ? r < 0 : r > 0;
    return `<span class="kp-d ${good ? 'up' : 'down'}">${r > 0 ? '▲' : '▼'} ${Math.abs(r * 100).toFixed(1)}%</span>`;
  }

  /* ── 보조 데이터 (이름 찾기) ─────────── */
  let names = null;
  async function loadNames() {
    if (names) return names;
    names = { space: {}, mag: {}, guide: {}, cat: {}, test: {} };
    const get = (u) => fetch(u, { cache: 'no-cache' }).then((r) => r.json()).catch(() => null);
    const [sp, mg, gd, ts] = await Promise.all([H.loadSpaces().catch(() => null), get('/data/magazine.json'), get('/data/guides.json'), get('/data/test.json')]);
    if (sp) { sp.spaces.forEach((s) => (names.space[s.id] = s)); sp.categories.forEach((c) => (names.cat[c.id] = c.label)); names.allSpaces = sp.spaces; }
    (mg?.articles || []).forEach((a) => (names.mag[a.id] = a.title));
    (gd?.guides || gd?.articles || []).forEach((g) => (names.guide[g.id] = g.title));
    Object.values(ts?.types || {}).forEach((t) => (names.test[t.id] = t.name));
    return names;
  }
  const pageTitle = (path) => {
    if (STATIC[path]) return STATIC[path];
    let m;
    if ((m = /^\/place\/(.+)$/.exec(path))) return names.space[m[1]]?.name || m[1];
    if ((m = /^\/magazine\/(.+)$/.exec(path))) return names.mag[m[1]] || m[1];
    if ((m = /^\/guide\/(.+)$/.exec(path))) return names.guide[m[1]] || m[1];
    if ((m = /^\/c\/(.+)$/.exec(path))) return '분류 — ' + (names.cat[m[1]] || m[1]);
    if ((m = /^\/area\/(.+)$/.exec(path))) return '동네 — ' + (AREA[m[1]] || m[1]);
    if ((m = /^\/test\/result\/(.+)$/.exec(path))) return '테스트 결과 — ' + (names.test[m[1]] || m[1]);
    return path;
  };

  /* ── 상태 ────────────────────────────── */
  const ST = {
    days: +(localStorage.getItem('hp_kpi_days') || 7),
    from: '', to: '',
    metric: 'uv',
    placeSort: 'pv', placeAll: false,
    pageKind: '', pageAll: false,
    memberAll: false
  };
  let D = null;       // 마지막 응답
  let root = null, api = null;

  KPI.mount = async (el, apiFn) => {
    root = el; api = apiFn;
    await load();
  };

  async function load() {
    root.innerHTML = '<div class="sk">불러오는 중</div>';
    const qs = ST.from && ST.to ? `what=kpi&from=${ST.from}&to=${ST.to}` : `what=kpi&days=${ST.days}`;
    try {
      const [d] = await Promise.all([api(qs), loadNames()]);
      D = d;
      paint();
    } catch (e) {
      root.innerHTML = `<div class="ad-err">${esc(e.message)}</div><p class="muted small">데이터베이스(D1)가 연결되어 있는지 확인해 주세요.</p>`;
    }
  }

  /* ── 차트 조각 ───────────────────────── */
  /* 세로 막대 (한 계열): 기준선 하나, 막대 최대 24px, 위쪽만 둥글게, 최댓값과 마지막 값만 숫자 표시 */
  function cols(data, { val, label, tip, every = 1, height = 160, hi = -1 }) {
    const vals = data.map(val);
    const max = Math.max(1, ...vals);
    const nice = niceMax(max);
    const iMax = vals.indexOf(Math.max(...vals));
    const grid = [nice, nice / 2, 0].map((g) => `<div class="kp-gl" style="bottom:${(g / nice) * 100}%"><span>${n(Math.round(g))}</span></div>`).join('');
    return `<div class="kp-cols" style="height:${height}px">
      <div class="kp-grid">${grid}</div>
      <div class="kp-colrow">
        ${data.map((d, i) => {
          const v = vals[i];
          const h = v ? Math.max(2, (v / nice) * 100) : 0;
          const show = v && (i === iMax || i === data.length - 1);
          return `<div class="kp-col${i === hi ? ' hi' : ''}" data-tip="${esc(tip(d))}" tabindex="0">
            <i style="height:${h}%">${show ? `<em>${n(v)}</em>` : ''}</i>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="kp-xrow">${data.map((d, i) => `<span>${i % every === 0 ? esc(label(d, i)) : ''}</span>`).join('')}</div>`;
  }
  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  /* 가로 막대 목록: 이름 · 막대 · 값 · 비율 */
  function hbars(rows, { name, val, sub, total }) {
    const max = Math.max(1, ...rows.map(val));
    const tot = total ?? rows.reduce((s, r) => s + val(r), 0);
    if (!rows.length) return '<p class="muted small">아직 데이터가 없습니다.</p>';
    return `<div class="kp-hb">${rows.map((r) => `
      <div class="kp-hb-row" data-tip="${esc(name(r))} — ${n(val(r))}${tot ? ` (${pct(val(r) / tot)})` : ''}">
        <span class="kp-hb-n">${esc(name(r))}${sub ? `<small>${esc(sub(r))}</small>` : ''}</span>
        <span class="kp-hb-t"><i style="width:${(val(r) / max) * 100}%"></i></span>
        <span class="kp-hb-v">${n(val(r))}<small>${tot ? pct(val(r) / tot) : ''}</small></span>
      </div>`).join('')}</div>`;
  }
  const tile = (label, value, d = '', note = '') => `<div class="ad-tile kp-tile"><small>${label}</small><b>${value}</b>${d}${note ? `<span>${note}</span>` : ''}</div>`;
  const table = (head, rows, cls = '') => `<div class="kp-tw"><table class="ad-table kp-table ${cls}"><thead><tr>${head.map((h) => `<th${h.r ? ' class="r"' : ''}>${h.t}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}" class="muted small">아직 데이터가 없습니다.</td></tr>`}</tbody></table></div>`;

  /* ── CSV ─────────────────────────────── */
  function download(name, head, rows) {
    const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const text = '﻿' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = `honplace-${name}-${D.range.from}_${D.range.to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ── 그리기 ──────────────────────────── */
  function paint() {
    const d = D, S = d.sum || {}, P = d.prevSum || {};
    const ok = d.schemaOk && d.sum;
    const notrack = localStorage.getItem('hp_notrack') === '1';
    const periods = [[1, '오늘'], [7, '7일'], [30, '30일'], [90, '90일']];
    const custom = !!(ST.from && ST.to);

    const bar = `
      <div class="kp-bar">
        <div class="chips kp-periods" role="group" aria-label="기간">
          ${periods.map(([v, l]) => `<button class="chip${!custom && ST.days === v ? ' on' : ''}" data-days="${v}">${l}</button>`).join('')}
          <button class="chip${custom ? ' on' : ''}" data-custom>직접 지정</button>
        </div>
        <div class="kp-range">${d.range.days === 1 ? md(d.range.from) : `${md(d.range.from)} – ${md(d.range.to)}`} <span>· ${d.range.days === 1 ? `어제(${md(d.prev.from)})` : `직전 ${d.range.days}일(${md(d.prev.from)} – ${md(d.prev.to)})`}과 비교</span></div>
        <div class="kp-bar-r">
          ${ok ? `<span class="kp-live" data-tip="최근 5분 안에 페이지를 연 방문자">${d.live?.n ? '<i></i>' : ''}지금 ${n(d.live?.n)}명</span>` : ''}
          <button class="btn ghost sm" data-reload>새로고침</button>
        </div>
      </div>
      <form class="kp-custom${custom ? '' : ' hide'}" data-custom-form>
        <input type="date" name="from" value="${esc(ST.from || d.range.from)}" max="${d.today}" required>
        <span>–</span>
        <input type="date" name="to" value="${esc(ST.to || d.range.to)}" max="${d.today}" required>
        <button class="btn sm" type="submit">적용</button>
      </form>`;

    const warn = !d.schemaOk ? `
      <div class="ad-err kp-warn">방문 통계 테이블이 아직 없습니다. Cloudflare → D1 → honplace-db → Console 에서 <code>migrations/003-analytics.sql</code> 내용을 실행해 주세요. 실행한 뒤부터 방문·클릭·체류시간이 쌓입니다. 아래의 게시판·회원 지표는 지금도 볼 수 있습니다.</div>` : '';

    const empty = ok && !d.total?.pv ? `
      <div class="notice">${H.icon('i-info')}<div>아직 쌓인 방문 기록이 없습니다. 이번 배포 이후 사이트를 연 방문부터 기록됩니다. 관리자 화면(/admin)은 기록하지 않습니다.</div></div>` : '';

    const since = ok && d.total?.first ? `<p class="kp-since">${md(d.total.first)}부터 수집 · 누적 방문자 ${n(d.total.uv)}명 · 누적 조회 ${n(d.total.pv)}회 · 오늘 방문자 ${n(d.todayNow?.uv)}명
      <label class="kp-notrack"><input type="checkbox" data-notrack${notrack ? ' checked' : ''}> 이 브라우저의 내 방문은 빼기</label></p>` : (ok ? `<p class="kp-since"><label class="kp-notrack"><input type="checkbox" data-notrack${notrack ? ' checked' : ''}> 이 브라우저의 내 방문은 빼기</label></p>` : '');

    const partial = ok && d.total?.first && d.total.first > d.prev.from
      ? `<p class="kp-cap kp-partial">${H.icon('i-info')}비교 기간(${md(d.prev.from)} – ${md(d.prev.to)})의 일부 또는 전부가 수집 시작(${md(d.total.first)}) 전이라 증감이 실제보다 크게 보입니다.</p>` : '';
    let html = bar + warn + empty + since + partial;

    if (ok) {
      /* 1. 핵심 지표 */
      html += `
      <h2 class="ad-h">핵심 지표</h2>
      <div class="ad-tiles kp-tiles">
        ${tile('방문자', n(S.uv), delta(S.uv, P.uv), `신규 ${n(S.newv)} · 재방문 ${n(S.returning)}`)}
        ${tile('페이지뷰', n(S.pv), delta(S.pv, P.pv), `방문당 ${S.pps.toFixed(1)}쪽`)}
        ${tile('방문 수', n(S.sessions), delta(S.sessions, P.sessions), '30분 쉬면 새 방문')}
        ${tile('평균 체류시간', dur(S.dwell), delta(S.dwell, P.dwell), `한 번 방문 ${dur(S.sessionDwell)}`)}
        ${tile('이탈률', pct(S.bounce), delta(S.bounce, P.bounce, { down: true, ratio: true }), '한 쪽만 보고 나간 방문')}
        ${tile('지도 열기', n(S.map), delta(S.map, P.map), `${n(S.mapUv)}명이 눌렀습니다`)}
        ${tile('지도 전환율', pct(S.mapRate), delta(S.mapRate, P.mapRate, { ratio: true }), '플레이스를 본 방문 중 지도를 연 비율')}
        ${tile('가고 싶어요', n(S.likes), delta(S.likes, P.likes), '이 기간에 새로 저장')}
      </div>
      <div class="kp-mini">
        <span>플레이스 조회 <b>${n(S.placePv)}</b>${delta(S.placePv, P.placePv)}</span>
        <span>신규 방문자 비율 <b>${pct(S.uv ? S.newv / S.uv : 0)}</b></span>
        <span>공유 <b>${n(S.share)}</b></span>
        <span>외부 링크 <b>${n(S.out)}</b></span>
        <span>목록 검색 <b>${n(S.search)}</b></span>
        <span>테스트 완료 <b>${n(S.testDone)}</b>${S.testStart ? ` <small>(시작의 ${pct(S.testDone / S.testStart, 0)})</small>` : ''}</span>
      </div>`;

      /* 2. 일별 추이 */
      const METRICS = { uv: ['방문자', (x) => x.uv], pv: ['페이지뷰', (x) => x.pv], sessions: ['방문 수', (x) => x.sessions], map: ['지도 열기', (x) => x.map], likes: ['가고 싶어요', (x) => x.likes], posts: ['새 글', (x) => x.posts || 0] };
      const [mLabel, mVal] = METRICS[ST.metric] || METRICS.uv;
      const totalM = d.daily.reduce((s, x) => s + mVal(x), 0);
      const every = d.daily.length > 60 ? 14 : d.daily.length > 31 ? 7 : d.daily.length > 14 ? 5 : d.daily.length > 7 ? 2 : 1;
      html += `
      <h2 class="ad-h">${d.daily.length > 1 ? '일별 추이' : '오늘'}</h2>
      <div class="chips kp-metrics">${Object.entries(METRICS).map(([k, [l]]) => `<button class="chip${ST.metric === k ? ' on' : ''}" data-metric="${k}">${l}</button>`).join('')}</div>
      <p class="kp-cap">${mLabel} — 합계 ${n(totalM)}${d.daily.length > 1 ? ` · 하루 평균 ${n(Math.round(totalM / d.daily.length))}` : ''}${ST.metric === 'uv' && d.daily.length > 1 ? ' <small>(날마다 센 방문자의 합이라 위 방문자 수보다 큽니다)</small>' : ''}</p>
      ${d.daily.length > 1
        ? cols(d.daily, { val: mVal, label: (x) => x.day.slice(5).replace('-', '/'), tip: (x) => `${md(x.day)} (${wdName[new Date(x.day + 'T00:00:00Z').getUTCDay()]}) — ${mLabel} ${n(mVal(x))}`, every, hi: d.daily.length - 1 })
        : cols(d.hours, { val: (x) => ST.metric === 'uv' ? x.uv : x.pv, label: (x) => x.hour + '시', tip: (x) => `${x.hour}시 — 방문자 ${n(x.uv)} · 페이지뷰 ${n(x.pv)}`, every: 3 })}`;

      /* 3. 시간대 · 요일 */
      const hourMax = d.hours.reduce((a, b) => (b.pv > a.pv ? b : a), d.hours[0]);
      const wdMax = d.weekdays.reduce((a, b) => (b.pv > a.pv ? b : a), d.weekdays[0]);
      html += `
      <div class="kp-two">
        <section>
          <h2 class="ad-h">시간대별 방문</h2>
          <p class="kp-cap">가장 붐비는 때 ${hourMax.pv ? `${hourMax.hour}시 (페이지뷰 ${n(hourMax.pv)})` : '—'} · 한국 시간</p>
          ${cols(d.hours, { val: (x) => x.pv, label: (x) => x.hour, tip: (x) => `${x.hour}시 — 페이지뷰 ${n(x.pv)} · 방문자 ${n(x.uv)}`, every: 3, height: 130 })}
        </section>
        <section>
          <h2 class="ad-h">요일별 방문</h2>
          <p class="kp-cap">가장 많은 요일 ${wdMax.pv ? `${wdName[wdMax.wd]}요일 (페이지뷰 ${n(wdMax.pv)})` : '—'}</p>
          ${cols([1, 2, 3, 4, 5, 6, 0].map((w) => d.weekdays[w]), { val: (x) => x.pv, label: (x) => wdName[x.wd], tip: (x) => `${wdName[x.wd]}요일 — 페이지뷰 ${n(x.pv)} · 방문자 ${n(x.uv)}`, height: 130 })}
        </section>
      </div>`;

      /* 4. 유입 · 기기 */
      const groups = {};
      (d.refs || []).forEach((r) => { const g = refGroup(r.ref_type, r.ref_host); groups[g] = (groups[g] || 0) + r.sessions; });
      const gRows = Object.entries(groups).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
      const searchShare = gRows.filter((r) => /검색/.test(r.k)).reduce((s, r) => s + r.v, 0);
      const DV = { mobile: '휴대폰', desktop: '컴퓨터', tablet: '태블릿' };
      html += `
      <div class="kp-two">
        <section>
          <h2 class="ad-h">어디서 들어왔나</h2>
          <p class="kp-cap">방문의 첫 페이지 기준 · 검색 유입 ${pct(S.sessions ? searchShare / S.sessions : 0)}</p>
          ${hbars(gRows, { name: (r) => r.k, val: (r) => r.v })}
          <h2 class="ad-h" style="margin-top:26px">기기</h2>
          <p class="kp-cap">방문자 기준</p>
          ${hbars(d.devices || [], { name: (r) => DV[r.device] || r.device, val: (r) => r.uv, sub: (r) => `페이지뷰 ${n(r.pv)}` })}
        </section>
        <section>
          <h2 class="ad-h">페이지 유형</h2>
          <p class="kp-cap">페이지뷰 기준</p>
          ${hbars(d.kinds || [], { name: (r) => KIND[r.kind] || r.kind, val: (r) => r.pv, sub: (r) => `평균 ${dur(r.dwell)}` })}
        </section>
      </div>`;

      /* 5. 인기 지점 */
      const PS = { pv: ['조회수', (x) => x.pv], uv: ['방문자', (x) => x.uv], map: ['지도 열기', (x) => x.map], mapRate: ['지도 전환율', (x) => (x.uv >= 5 ? x.mapRate : -1)], likes: ['가고 싶어요', (x) => x.likesNew * 1000 + x.likesAll], posts: ['후기', (x) => x.posts * 1000 + x.postsAll], dwell: ['체류시간', (x) => (x.pv >= 3 ? x.dwell : -1)] };
      const places = (d.places || []).filter((x) => names.space[x.space_id] || x.pv);
      const sorted = places.slice().sort((a, b) => PS[ST.placeSort][1](b) - PS[ST.placeSort][1](a) || b.pv - a.pv);
      const shown = ST.placeAll ? sorted : sorted.slice(0, 20);
      const unseen = (names.allSpaces || []).filter((s) => !places.some((x) => x.space_id === s.id && x.pv));
      const prow = (x, i) => {
        const s = names.space[x.space_id];
        return `<tr>
          <td class="kp-rank">${i + 1}</td>
          <td><a href="/place/${encodeURIComponent(x.space_id)}" target="_blank" rel="noopener">${esc(s?.name || x.space_id)}</a>${s?.kind === 'type' ? ' <span class="tag kind">유형</span>' : ''}<div class="kp-sub">${esc(names.cat[s?.cat] || '')}${s ? ' · ' + esc(s.area) : ' · 데이터에 없는 id'}</div></td>
          <td class="r">${n(x.pv)}</td>
          <td class="r">${n(x.uv)}</td>
          <td class="r">${dur(x.dwell)}</td>
          <td class="r">${n(x.map)}${x.map ? `<div class="kp-sub">네이버 ${n(x.mapNaver)} · 구글 ${n(x.mapGoogle)}</div>` : ''}</td>
          <td class="r">${x.uv ? pct(x.mapRate, 0) : '—'}</td>
          <td class="r">${x.likesNew ? '+' + n(x.likesNew) : '0'}<div class="kp-sub">누적 ${n(x.likesAll)}</div></td>
          <td class="r">${n(x.posts)}<div class="kp-sub">누적 ${n(x.postsAll)}</div></td>
        </tr>`;
      };
      html += `
      <h2 class="ad-h">인기 지점</h2>
      <div class="kp-tools">
        <div class="chips">${Object.entries(PS).map(([k, [l]]) => `<button class="chip${ST.placeSort === k ? ' on' : ''}" data-psort="${k}">${l}</button>`).join('')}</div>
        <button class="btn ghost sm" data-csv="places">CSV 내려받기</button>
      </div>
      <p class="kp-cap">이 기간에 조회된 지점 ${n(places.filter((x) => x.pv).length)}곳${ST.placeSort === 'mapRate' ? ' · 전환율은 방문자 5명 이상인 곳만 순위에 넣습니다' : ''}</p>
      ${table([{ t: '#' }, { t: '지점' }, { t: '조회', r: 1 }, { t: '방문자', r: 1 }, { t: '평균 체류', r: 1 }, { t: '지도 열기', r: 1 }, { t: '지도 전환', r: 1 }, { t: '가고 싶어요', r: 1 }, { t: '후기', r: 1 }], shown.map(prow), 'kp-places')}
      ${sorted.length > 20 ? `<button class="btn ghost sm kp-more" data-pall>${ST.placeAll ? '20곳만 보기' : `전체 ${sorted.length}곳 보기`}</button>` : ''}
      ${unseen.length ? `<details class="kp-unseen"><summary>이 기간에 한 번도 열리지 않은 지점 ${unseen.length}곳</summary><p>${unseen.map((s) => `<a href="/place/${encodeURIComponent(s.id)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(' · ')}</p><p class="muted small">소개 글을 손보거나, 매거진·분류 페이지에서 링크를 걸어 주면 노출이 늘어납니다.</p></details>` : ''}`;

      /* 6. 페이지별 */
      const kinds = ['', ...new Set((d.pages || []).map((p) => p.kind))];
      const pages = (d.pages || []).filter((p) => !ST.pageKind || p.kind === ST.pageKind);
      const pShown = ST.pageAll ? pages : pages.slice(0, 25);
      html += `
      <h2 class="ad-h">페이지별 방문</h2>
      <div class="kp-tools">
        <div class="chips">${kinds.map((k) => `<button class="chip${ST.pageKind === k ? ' on' : ''}" data-pkind="${k}">${k ? KIND[k] || k : '전체'}</button>`).join('')}</div>
        <button class="btn ghost sm" data-csv="pages">CSV 내려받기</button>
      </div>
      ${table([{ t: '페이지' }, { t: '조회', r: 1 }, { t: '방문자', r: 1 }, { t: '평균 체류', r: 1 }, { t: '첫 페이지로 들어옴', r: 1 }, { t: '이탈률', r: 1 }],
        pShown.map((p) => `<tr>
          <td><a href="${esc(p.path)}" target="_blank" rel="noopener">${esc(pageTitle(p.path))}</a><div class="kp-sub">${esc(p.path)} · ${esc(KIND[p.kind] || p.kind)}</div></td>
          <td class="r">${n(p.pv)}</td><td class="r">${n(p.uv)}</td><td class="r">${dur(p.dwell)}</td>
          <td class="r">${n(p.entries)}</td><td class="r">${p.entries ? pct(p.bounce, 0) : '—'}</td>
        </tr>`))}
      ${pages.length > 25 ? `<button class="btn ghost sm kp-more" data-pgall>${ST.pageAll ? '25개만 보기' : `전체 ${pages.length}개 보기`}</button>` : ''}`;

      /* 7. 검색 유입 랜딩 · 유입 상세 */
      html += `
      <div class="kp-two">
        <section>
          <h2 class="ad-h">검색으로 들어온 페이지</h2>
          <p class="kp-cap">네이버·구글에서 어떤 페이지가 잘 걸리는지</p>
          ${table([{ t: '페이지' }, { t: '검색 유입', r: 1 }, { t: '네이버', r: 1 }, { t: '구글', r: 1 }],
            (d.landings || []).slice(0, 15).map((x) => `<tr><td><a href="${esc(x.path)}" target="_blank" rel="noopener">${esc(pageTitle(x.path))}</a></td><td class="r">${n(x.n)}</td><td class="r">${n(x.naver)}</td><td class="r">${n(x.google)}</td></tr>`))}
        </section>
        <section>
          <h2 class="ad-h">유입 상세</h2>
          <p class="kp-cap">출처별 방문 수</p>
          ${table([{ t: '출처' }, { t: '구분' }, { t: '방문', r: 1 }, { t: '방문자', r: 1 }],
            (d.refs || []).slice(0, 15).map((r) => `<tr><td>${esc(r.ref_host || (r.ref_type === 'direct' ? '주소 입력·즐겨찾기·앱' : '—'))}</td><td>${esc(refName(r.ref_type, r.ref_host))}</td><td class="r">${n(r.sessions)}</td><td class="r">${n(r.uv)}</td></tr>`))}
          ${(d.keywords || []).length ? `<h2 class="ad-h" style="margin-top:26px">검색어 · 캠페인</h2>
          <p class="kp-cap">검색엔진이 검색어를 넘겨준 경우만 보입니다(대부분 넘기지 않습니다)</p>
          ${table([{ t: '검색어 / 캠페인' }, { t: '출처' }, { t: '방문', r: 1 }], d.keywords.slice(0, 15).map((k) => `<tr><td>${esc(k.kw)}</td><td>${esc(k.ref_type === 'campaign' ? '캠페인 ' + (k.ref_host || '') : refName(k.ref_type, k.ref_host))}</td><td class="r">${n(k.n)}</td></tr>`))}` : ''}
        </section>
      </div>`;

      /* 8. 클릭·행동 · 테스트 · 사이트 내 검색 */
      const ev = d.events || [];
      const agg = {};
      ev.forEach((e) => {
        const key = ['map', 'cta', 'post'].includes(e.type) ? e.type + ':' + (e.label || '') : e.type === 'out' ? 'out:' + (e.label || '') : e.type;
        const a = (agg[key] = agg[key] || { type: e.type, label: ['map', 'cta', 'post', 'out'].includes(e.type) ? e.label : '', n: 0, uv: 0 });
        a.n += e.n; a.uv += e.uv;
      });
      const evRows = Object.values(agg).sort((a, b) => b.n - a.n).slice(0, 24);
      const tests = ev.filter((e) => e.type === 'test_result').sort((a, b) => b.n - a.n);
      const searches = ev.filter((e) => e.type === 'search').sort((a, b) => b.n - a.n).slice(0, 12);
      const filters = ev.filter((e) => e.type === 'filter').sort((a, b) => b.n - a.n).slice(0, 8);
      const FL = { talk: { 0: '조용히 있어도 됨', 1: '원하면 한마디', 2: '이야기가 중심' }, time: { day: '낮', evening: '저녁', night: '밤늦게' }, saved: { 1: '저장한 곳' } };
      const filterName = (l) => { const [k, v] = String(l || '').split(':'); return k === 'cat' ? '종류 — ' + (names.cat[v] || v) : k === 'talk' ? '대화 — ' + (FL.talk[v] || v) : k === 'time' ? '시간 — ' + (FL.time[v] || v) : k === 'saved' ? '저장한 곳' : l; };
      html += `
      <div class="kp-two">
        <section>
          <h2 class="ad-h">클릭과 행동</h2>
          <p class="kp-cap">횟수와 그 행동을 한 사람 수</p>
          ${table([{ t: '행동' }, { t: '횟수', r: 1 }, { t: '사람', r: 1 }], evRows.map((e) => `<tr><td>${esc(evName(e.type, e.label))}</td><td class="r">${n(e.n)}</td><td class="r">${n(e.uv)}</td></tr>`))}
        </section>
        <section>
          <h2 class="ad-h">혼자력 테스트</h2>
          <p class="kp-cap">시작 ${n(S.testStart)} → 완료 ${n(S.testDone)}${S.testStart ? ` (${pct(S.testDone / S.testStart, 0)})` : ''}</p>
          ${hbars(tests, { name: (e) => names.test[e.label] || e.label, val: (e) => e.n })}
          <h2 class="ad-h" style="margin-top:26px">플레이스 목록에서 찾은 말</h2>
          ${searches.length ? hbars(searches, { name: (e) => e.label, val: (e) => e.n }) : '<p class="muted small">아직 없습니다.</p>'}
          ${filters.length ? `<h2 class="ad-h" style="margin-top:26px">많이 쓴 필터</h2>${hbars(filters, { name: (e) => filterName(e.label), val: (e) => e.n })}` : ''}
        </section>
      </div>`;
    }

    /* 9. 커뮤니티 */
    if (d.community) {
      const C = d.community, PC = d.prevCommunity || {};
      html += `
      <h2 class="ad-h">커뮤니티</h2>
      <div class="ad-tiles kp-tiles kp-t3">
        ${tile('새 글', n(C.posts), delta(C.posts, PC.posts), `글쓴이 ${n(C.writers)}명`)}
        ${tile('플레이스 후기', n(C.reviews), delta(C.reviews, PC.reviews), '플레이스에 달린 글')}
        ${tile('답글', n(C.comments), delta(C.comments, PC.comments))}
        ${tile('받은 반응', n(C.reactions), delta(C.reactions, PC.reactions), '이 기간 글에 달린 나도·고마워·가볼게')}
        ${tile('신고된 글', n(C.reported), delta(C.reported, PC.reported, { down: true }))}
        ${tile('플레이스 제보', n(C.subs), delta(C.subs, PC.subs))}
      </div>`;
    }

    /* 10. 회원 (호스트) */
    if (d.members) {
      const M = d.members;
      const list = ST.memberAll ? M.list : M.list.slice(0, 15);
      html += `
      <h2 class="ad-h">회원 (호스트)</h2>
      <p class="kp-cap">혼플은 이름을 묻지 않는 익명 서비스라 일반 회원가입이 없습니다. 계정(호스트 키)을 가진 회원은 호스트뿐이고, 일반 이용자는 위의 방문자 수로 봅니다.</p>
      <div class="ad-tiles kp-tiles">
        ${tile('전체 회원', n(M.total), '', '호스트 신청 누적')}
        ${tile('인증 회원', n(M.verified), '', `이 기간 인증 ${n(M.verifiedInRange)}곳`)}
        ${tile('이 기간 가입', n(M.newInRange), delta(M.newInRange, M.newPrev))}
        ${tile('심사 대기', n(M.pending), '', M.pending ? '<a href="#hosts" data-go-hosts>호스트 탭에서 처리</a>' : '없음')}
      </div>
      <div class="kp-tools" style="margin-top:16px">
        <span class="kp-cap" style="margin:0">회원 목록 ${n(M.list.length)}명</span>
        <button class="btn ghost sm" data-csv="members">CSV 내려받기</button>
      </div>
      ${table([{ t: '공간' }, { t: '담당자' }, { t: '이메일' }, { t: '상태' }, { t: '가입' }, { t: '인증' }, { t: '안내 수정' }, { t: '답글', r: 1 }],
        list.map((h) => `<tr>
          <td>${h.space_id ? `<a href="/place/${encodeURIComponent(h.space_id)}" target="_blank" rel="noopener">${esc(h.space_name)}</a>` : esc(h.space_name)}<div class="kp-sub">${esc(names.cat[h.cat] || '')}${h.area ? ' · ' + esc(h.area) : ''}</div></td>
          <td>${esc(h.owner_name || '')}</td>
          <td><a href="mailto:${esc(h.email || '')}">${esc(h.email || '')}</a></td>
          <td><span class="kp-st ${esc(h.status)}">${STATUS[h.status] || esc(h.status)}</span></td>
          <td class="kp-when">${(h.created_at || '').slice(0, 10)}</td>
          <td class="kp-when">${(h.verified_at || '').slice(0, 10) || '—'}</td>
          <td class="kp-when">${(h.pub_updated_at || '').slice(0, 10) || '—'}</td>
          <td class="r">${n(h.replies)}</td>
        </tr>`), 'kp-members')}
      ${M.list.length > 15 ? `<button class="btn ghost sm kp-more" data-mall>${ST.memberAll ? '15명만 보기' : `전체 ${M.list.length}명 보기`}</button>` : ''}`;
    }

    /* 11. 지표 정의 */
    html += `
      <details class="kp-def">
        <summary>지표는 이렇게 셉니다</summary>
        <dl>
          <dt>방문자</dt><dd>브라우저 하나를 한 명으로 셉니다. 사이트가 브라우저에 무작위 번호를 저장해 구분하며, 이름·연락처·IP는 쓰지 않습니다. 같은 사람이 휴대폰과 컴퓨터로 오면 두 명이 되고, 브라우저 기록을 지우면 새 방문자가 됩니다.</dd>
          <dt>페이지뷰</dt><dd>페이지를 연 횟수. 같은 페이지를 다시 열면 또 셉니다.</dd>
          <dt>방문 수</dt><dd>한 번 들어와서 나갈 때까지. 30분 넘게 움직임이 없다가 다시 오면 새 방문입니다.</dd>
          <dt>평균 체류시간</dt><dd>페이지가 실제로 화면에 보이던 시간의 평균. 다른 탭으로 가 있던 시간은 빼고, 1초 미만은 제외, 30분 넘는 값은 30분으로 자릅니다. ‘한 번 방문’은 한 방문 동안 본 페이지들의 체류시간 합의 평균입니다.</dd>
          <dt>이탈률</dt><dd>한 페이지만 보고 나간 방문의 비율. 페이지별 이탈률은 그 페이지로 들어온 방문 중 그 페이지만 보고 나간 비율입니다.</dd>
          <dt>지도 열기 · 지도 전환율</dt><dd>플레이스 페이지의 네이버지도·구글지도·카카오맵 버튼을 누른 횟수. 전환율은 플레이스 페이지를 본 방문 중 지도를 연 방문의 비율로, ‘실제로 가 보려는 사람’에 가장 가까운 지표입니다.</dd>
          <dt>가고 싶어요</dt><dd>플레이스 페이지의 저장 버튼. 브라우저당 한 번만 셉니다. ‘+n’은 이 기간에 새로 눌린 수, ‘누적’은 지금까지 남아 있는 수입니다.</dd>
          <dt>어디서 들어왔나</dt><dd>방문의 첫 페이지를 열 때 브라우저가 알려 준 이전 주소로 나눕니다. 앱 안 브라우저나 메신저에서 온 경우 출처가 비어 ‘직접 방문’으로 잡힐 수 있습니다. 링크에 <code>?utm_source=…&amp;utm_campaign=…</code>을 붙이면 캠페인으로 따로 셉니다.</dd>
          <dt>제외되는 것</dt><dd>검색엔진 수집 봇, 관리자 화면, ‘내 방문은 빼기’를 켠 브라우저. 400일이 지난 기록은 자동으로 지웁니다.</dd>
        </dl>
      </details>`;

    root.innerHTML = `<div class="kp">${html}</div>`;
    bind();
  }

  /* ── 이벤트 ──────────────────────────── */
  function bind() {
    const q = (s) => root.querySelector(s), qa = (s) => root.querySelectorAll(s);
    qa('[data-days]').forEach((b) => b.onclick = () => { ST.days = +b.dataset.days; ST.from = ST.to = ''; localStorage.setItem('hp_kpi_days', ST.days); load(); });
    q('[data-custom]') && (q('[data-custom]').onclick = () => q('[data-custom-form]').classList.toggle('hide'));
    q('[data-custom-form]') && q('[data-custom-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      ST.from = f.get('from'); ST.to = f.get('to'); load();
    });
    q('[data-reload]').onclick = load;
    qa('[data-metric]').forEach((b) => b.onclick = () => { ST.metric = b.dataset.metric; paint(); });
    qa('[data-psort]').forEach((b) => b.onclick = () => { ST.placeSort = b.dataset.psort; paint(); });
    qa('[data-pkind]').forEach((b) => b.onclick = () => { ST.pageKind = b.dataset.pkind; ST.pageAll = false; paint(); });
    q('[data-pall]') && (q('[data-pall]').onclick = () => { ST.placeAll = !ST.placeAll; paint(); });
    q('[data-pgall]') && (q('[data-pgall]').onclick = () => { ST.pageAll = !ST.pageAll; paint(); });
    q('[data-mall]') && (q('[data-mall]').onclick = () => { ST.memberAll = !ST.memberAll; paint(); });
    q('[data-go-hosts]') && (q('[data-go-hosts]').onclick = (e) => { e.preventDefault(); location.hash = 'hosts'; });
    q('[data-notrack]') && (q('[data-notrack]').onchange = (e) => {
      if (e.target.checked) localStorage.setItem('hp_notrack', '1'); else localStorage.removeItem('hp_notrack');
      H.toast(e.target.checked ? '이 브라우저의 방문은 이제 기록하지 않습니다' : '이 브라우저의 방문도 다시 기록합니다');
    });
    qa('[data-csv]').forEach((b) => b.onclick = () => {
      const k = b.dataset.csv;
      if (k === 'places') {
        download('places', ['지점 id', '지점', '분류', '동네', '조회', '방문자', '평균 체류(초)', '지도 열기', '네이버지도', '구글지도', '지도 전환율', '가고 싶어요(기간)', '가고 싶어요(누적)', '후기(기간)', '후기(누적)', '공유'],
          (D.places || []).slice().sort((a, b) => b.pv - a.pv).map((x) => { const s = names.space[x.space_id] || {}; return [x.space_id, s.name || '', names.cat[s.cat] || '', s.area || '', x.pv, x.uv, Math.round(x.dwell / 1000), x.map, x.mapNaver, x.mapGoogle, (x.mapRate * 100).toFixed(1) + '%', x.likesNew, x.likesAll, x.posts, x.postsAll, x.share]; }));
      } else if (k === 'pages') {
        download('pages', ['경로', '페이지', '유형', '조회', '방문자', '평균 체류(초)', '첫 페이지로 들어옴', '이탈률'],
          (D.pages || []).map((p) => [p.path, pageTitle(p.path), KIND[p.kind] || p.kind, p.pv, p.uv, Math.round(p.dwell / 1000), p.entries, p.entries ? (p.bounce * 100).toFixed(1) + '%' : '']));
      } else if (k === 'members') {
        download('members', ['공간', '분류', '동네', '담당자', '이메일', '전화', '상태', '가입일', '인증일', '안내 수정일', '호스트 답글'],
          (D.members?.list || []).map((h) => [h.space_name, names.cat[h.cat] || '', h.area || '', h.owner_name || '', h.email || '', h.phone || '', STATUS[h.status] || h.status, (h.created_at || '').slice(0, 10), (h.verified_at || '').slice(0, 10), (h.pub_updated_at || '').slice(0, 10), h.replies || 0]));
      }
    });
  }

  /* ── 툴팁 (마우스·키보드 공용) ───────── */
  let tipEl = null;
  const showTip = (el) => {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'kp-tip'; document.body.appendChild(tipEl); }
    tipEl.textContent = el.dataset.tip;
    const r = el.getBoundingClientRect();
    tipEl.style.display = 'block';
    const w = tipEl.offsetWidth;
    tipEl.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)) + 'px';
    tipEl.style.top = (r.top + window.scrollY - tipEl.offsetHeight - 8) + 'px';
  };
  const hideTip = () => { if (tipEl) tipEl.style.display = 'none'; };
  document.addEventListener('mouseover', (e) => { const el = e.target.closest?.('.kp [data-tip]'); if (el) showTip(el); else hideTip(); });
  document.addEventListener('focusin', (e) => { const el = e.target.closest?.('.kp [data-tip]'); if (el) showTip(el); });
  document.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });
})();
