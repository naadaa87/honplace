/* 혼플 spaces.js */
(async function () {
  const { categories, spaces } = await H.loadSpaces();
  const url = new URL(location.href);
  const state = {
    cat: url.searchParams.get('cat') || '',
    talk: url.searchParams.get('talk') || '',   // '', '0', '1', '2', '12'
    time: url.searchParams.get('time') || '',
    q: url.searchParams.get('q') || '',
    saved: url.searchParams.get('saved') || ''
  };
  /* 플레이스 페이지에서 '가고 싶어요'로 저장한 곳 (이 기기에만 있음) */
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('hp_liked') || '[]'); } catch { saved = []; }
  const savedRow = H.qs('[data-f-saved]');
  if (savedRow && (saved.length || state.saved)) {
    savedRow.classList.remove('hide');
    H.qs('[data-saved-n]', savedRow).textContent = saved.length;
  }

  const catRow = H.qs('[data-f-cat]');
  catRow.innerHTML = `<button class="chip" data-k="cat" data-v="">전체</button>` +
    categories.map((c) => `<button class="chip" data-k="cat" data-v="${c.id}">${H.esc(c.label)}</button>`).join('');

  const root = H.qs('[data-filters]');
  const list = H.qs('[data-list]');
  const count = H.qs('[data-count]');
  const input = H.qs('[data-q]');
  input.value = state.q;

  function paint() {
    H.qsa('.chip', root).forEach((c) => {
      const k = c.dataset.k, v = c.dataset.v;
      c.setAttribute('aria-pressed', String((state[k] || '') === v));
    });
  }
  /* 보기 방식: 사진 카드(기본) / 표. 고른 쪽을 이 기기에 기억합니다 */
  let view = 'card';
  try { view = localStorage.getItem('hp_view') === 'row' ? 'row' : 'card'; } catch { /* */ }
  let covers = {};
  const viewBtns = H.qsa('[data-view]');
  const paintView = () => viewBtns.forEach((b) => { const on = b.dataset.view === view; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  viewBtns.forEach((b) => b.addEventListener('click', () => {
    if (view === b.dataset.view) return;
    view = b.dataset.view;
    try { localStorage.setItem('hp_view', view); } catch { /* */ }
    paintView(); first = false; apply(); H.track('filter', 'view:' + view);
  }));
  paintView();
  /* 사진이 있는 곳을 앞에 — 같은 조건이면 혼자 지수 순 */
  const order = (a, b) => (view === 'card' ? Number(!!covers[b.id]) - Number(!!covers[a.id]) : 0) || b.solo - a.solo || a.name.localeCompare(b.name, 'ko');

  function apply() {
    if (first && view === 'card' && !state.cat && !state.talk && !state.time && !state.q && !state.saved) { first = false; paint(); return; }
    first = false;
    let r = spaces.slice();
    if (state.cat) r = r.filter((s) => s.cat === state.cat);
    if (state.talk === '0') r = r.filter((s) => s.talk === 0);
    if (state.talk === '1') r = r.filter((s) => s.talk === 1);
    if (state.talk === '2') r = r.filter((s) => s.talk === 2);
    if (state.talk === '12') r = r.filter((s) => s.talk >= 1);
    if (state.time) r = r.filter((s) => s.time.includes(state.time));
    if (state.saved) r = r.filter((s) => saved.includes(s.id));
    if (state.q) {
      const q = state.q.toLowerCase();
      r = r.filter((s) => [s.name, s.area, s.intro, ...(s.tags || [])].join(' ').toLowerCase().includes(q));
    }
    r.sort(order);
    count.textContent = r.length ? `${r.length}곳` : '';
    if (!r.length && state.saved && !saved.length) {
      list.innerHTML = `<div class="empty"><b>아직 저장한 곳이 없어요</b>플레이스 페이지에서 ‘가고 싶어요’를 누르면 이 기기에 저장되고 여기 모입니다.</div>`;
      count.textContent = '';
      return;
    }
    if (!r.length) {
      list.innerHTML = `<div class="empty"><b>이 조건에 맞는 곳이 아직 없어요</b>조건을 하나 풀어 보거나, 아는 곳이 있다면 <a href="/submit" style="text-decoration:underline">알려 주세요</a>.</div>`;
      return;
    }
    list.innerHTML = view === 'card'
      ? `<div class="pgrid">${r.map((s) => H.spaceCard(s, covers, { cat: !state.cat })).join('')}</div>`
      : H.sheetHead() + `<div class="sheet">${r.map((s) => H.spaceRow(s, { cat: !state.cat })).join('')}</div>`;
    const p = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => v && p.set(k, v));
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
    paint();
  }

  let first = true;
  root.addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    state[c.dataset.k] = c.dataset.v; apply();
    if (c.dataset.v) H.track('filter', c.dataset.k + ':' + c.dataset.v);
  });
  let tm, tq, lastQ = '';
  input.addEventListener('input', () => {
    clearTimeout(tm); tm = setTimeout(() => { state.q = input.value.trim(); apply(); }, 180);
    /* 검색어는 입력을 멈춘 뒤에 한 번만 기록 */
    clearTimeout(tq); tq = setTimeout(() => { const v = input.value.trim(); if (v.length >= 2 && v !== lastQ) { lastQ = v; H.track('search', v); } }, 1200);
  });
  /* 사진 표지를 받아 오면, 이미 조건을 건드린 뒤라면 다시 그립니다 */
  H.loadCovers().then((c) => { covers = c; if (!first) apply(); });
  apply();
})();
