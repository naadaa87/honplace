/* 혼곳 home.js — 문장으로 고르기 · 카운터 · 최근 이야기 */
(async function () {
  const { categories, spaces } = await H.loadSpaces();
  const now = H.now();

  /* ── 지금 ─────────────────────────────── */
  const nowEl = H.qs('[data-now]');
  if (nowEl) nowEl.textContent = `${now.label}. 이 시간에 갈 수 있는 곳부터 골라 두었어요.`;

  /* ── 불빛 그래픽: 한 줄에 늘어선 곳, 그중 하나에 불이 켜져 있다 ───────────────────── */
  const lights = H.qs('[data-lights]');
  function drawLights() {
    const W = Math.max(320, lights.clientWidth || 800);
    const gap = W < 600 ? 54 : 88, r = W < 600 ? 8 : 12;
    const n = Math.max(4, Math.floor((W - 40) / gap));
    const start = (W - (n - 1) * gap) / 2;
    const lit = new Date().getDay() % n;
    let svg = `<svg viewBox="0 0 ${W} 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><radialGradient id="cg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f3b640" stop-opacity=".5"/><stop offset="1" stop-color="#f3b640" stop-opacity="0"/></radialGradient></defs>
      <line x1="0" y1="62" x2="${W}" y2="62" stroke="#1c1c21" stroke-width="2"/>`;
    for (let i = 0; i < n; i++) {
      const x = start + i * gap;
      if (i === lit) {
        svg += `<circle class="glow" cx="${x}" cy="34" r="${r * 4}" fill="url(#cg)"/>`;
        svg += `<circle cx="${x}" cy="34" r="${r}" fill="#fff" stroke="#8c8c94" stroke-width="1.5"/><circle class="lit-on" cx="${x}" cy="34" r="${r * 1.3}" fill="#f3b640"/>`;
      } else {
        svg += `<circle cx="${x}" cy="34" r="${r}" fill="#fff" stroke="#8c8c94" stroke-width="1.5"/>`;
      }
    }
    lights.innerHTML = svg + '</svg>';
  }
  drawLights();
  requestAnimationFrame(() => requestAnimationFrame(() => lights.classList.add('lit')));
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawLights, 120); });

  /* ── 문장으로 고르기 ─────────────────── */
  const OPTS = {
    mood: [['quiet', '아무 말도 안 하고 싶은'], ['ambient', '사람 소리는 듣고 싶은'], ['chat', '몇 마디는 나누고 싶은']],
    time: [['day', '낮에'], ['evening', '저녁에'], ['night', '밤늦게']],
    budget: [['0', '거의 없어요'], ['1', '1~2만 원쯤이에요'], ['2', '3만 원 넘어도 괜찮아요']]
  };
  const Q = { mood: '오늘 기분은', time: '나갈 시간은', budget: '쓸 수 있는 돈은' };
  const state = { mood: null, time: now.slot, budget: null };
  const sentence = H.qs('[data-sentence]');
  const options = H.qs('[data-options]');
  const out = H.qs('[data-picks]');
  let openKey = null;

  function paint() {
    H.qsa('.blank', sentence).forEach((b) => {
      const k = b.dataset.k, v = state[k];
      const hit = v != null && OPTS[k].find((o) => o[0] === v);
      b.textContent = hit ? hit[1] : b.dataset.ph;
      b.dataset.empty = String(!hit);
      b.setAttribute('aria-expanded', String(openKey === k));
    });
  }
  function openFor(k) {
    openKey = k;
    if (!k) { options.classList.remove('open'); options.innerHTML = ''; paint(); return; }
    options.innerHTML = `<p class="q">${Q[k]}</p><div class="chips">${OPTS[k].map(([v, l]) => `<button type="button" class="chip" data-v="${v}" aria-pressed="${String(state[k] === v)}">${l}</button>`).join('')}</div>`;
    options.classList.add('open'); paint();
  }
  sentence.addEventListener('click', (e) => {
    const b = e.target.closest('.blank'); if (!b) return;
    openFor(openKey === b.dataset.k ? null : b.dataset.k);
  });
  options.addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c || !openKey) return;
    state[openKey] = c.dataset.v;
    const next = ['mood', 'time', 'budget'].find((k) => state[k] == null);
    openFor(next || null);
    run();
  });

  function match() {
    let list = spaces.slice();
    if (state.mood === 'quiet') list = list.filter((s) => s.talk === 0);
    if (state.mood === 'ambient') list = list.filter((s) => s.talk <= 1 && (s.tags.some((t) => /사람|기척|손님|서서|카운터|공연|벤치|이방인|24시간/.test(t)) || s.solo >= 5));
    if (state.mood === 'chat') list = list.filter((s) => s.talk >= 1);
    if (state.time) list = list.filter((s) => s.time.includes(state.time));
    if (state.budget != null) list = list.filter((s) => s.tier <= Number(state.budget));
    return list;
  }
  function run(shuffle) {
    let list = match();
    if (!list.length) {
      out.innerHTML = `<div class="head"><h2>딱 맞는 곳이 아직 없어요</h2></div><div class="empty">조건을 하나 바꿔 보거나, 아래 목록에서 직접 골라 보세요.</div>`;
      return;
    }
    list.sort((a, b) => {
      const ta = state.mood === 'chat' ? -a.talk : state.mood === 'ambient' ? -Math.min(a.talk, 1) : a.talk;
      const tb = state.mood === 'chat' ? -b.talk : state.mood === 'ambient' ? -Math.min(b.talk, 1) : b.talk;
      return ta - tb || b.solo - a.solo || (a.name < b.name ? -1 : 1);
    });
    if (shuffle) list = list.sort(() => Math.random() - 0.5);
    const picks = list.slice(0, 4);
    const q = new URLSearchParams();
    if (state.mood === 'quiet') q.set('talk', '0'); if (state.mood === 'chat') q.set('talk', '12');
    if (state.time) q.set('time', state.time);
    const filled = Object.values(state).filter((v) => v != null).length;
    out.innerHTML = `<div class="head"><h2>${filled >= 2 ? '이런 곳 어때요' : `${(OPTS.time.find((o) => o[0] === state.time) || [0, '지금'])[1]} 갈 수 있는 곳`}</h2><span>${list.length}곳 중 ${picks.length}곳</span></div>
      <div class="sheet">${picks.map((s) => H.spaceRow(s, { intro: true })).join('')}</div>
      <div class="pf"><button type="button" class="btn ghost sm" data-shuffle>다른 곳 보여 주기</button><a class="btn ghost sm" href="/spaces.html?${q}">이 조건으로 전부 보기</a></div>`;
  }
  out.addEventListener('click', (e) => { if (e.target.closest('[data-shuffle]')) run(true); });
  paint(); run();

  /* ── 카테고리 목차 ───────────────────── */
  H.qs('[data-toc]').innerHTML = categories.map((c) => {
    const n = spaces.filter((s) => s.cat === c.id).length;
    return `<a href="/spaces.html?cat=${c.id}">${H.icon('cat-' + c.id)}<span><span class="t">${H.esc(c.label)}</span><span class="d">${H.esc(c.desc)}</span></span><span class="n">${n}곳</span></a>`;
  }).join('');

  /* ── 최근 이야기 ───────────────────────── */
  const feedEl = H.qs('[data-home-feed]');
  try {
    const posts = await H.api.listPosts({ limit: 4 });
    Feed.render(feedEl, posts, { compact: true });
    Feed.bind(feedEl);
  } catch { feedEl.innerHTML = '<div class="sk">이야기를 불러오지 못했어요.</div>'; }

  /* ── 가이드 ───────────────────────────── */
  const { guides } = await H.loadGuides();
  const pick = ['honsulbar-first', 'honbap-first', 'sauna-night', 'social-light'].map((id) => guides.find((g) => g.id === id)).filter(Boolean);
  H.qs('[data-home-guides]').innerHTML = pick.map((g) => `<a class="gi" href="/guide.html?id=${g.id}"><span class="l1"><span class="t">${H.esc(g.title)}</span><span class="lead-line"></span><span class="m">${g.minutes}분</span></span><span class="sub">${H.esc(g.lead)}</span></a>`).join('');
})();
