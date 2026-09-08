/* 혼곳 spaces.js */
(async function () {
  const { categories, spaces } = await H.loadSpaces();
  const url = new URL(location.href);
  const state = {
    cat: url.searchParams.get('cat') || '',
    talk: url.searchParams.get('talk') || '',   // '', '0', '1', '2', '12'
    time: url.searchParams.get('time') || '',
    q: url.searchParams.get('q') || ''
  };

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
  function apply() {
    let r = spaces.slice();
    if (state.cat) r = r.filter((s) => s.cat === state.cat);
    if (state.talk === '0') r = r.filter((s) => s.talk === 0);
    if (state.talk === '1') r = r.filter((s) => s.talk === 1);
    if (state.talk === '2') r = r.filter((s) => s.talk === 2);
    if (state.talk === '12') r = r.filter((s) => s.talk >= 1);
    if (state.time) r = r.filter((s) => s.time.includes(state.time));
    if (state.q) {
      const q = state.q.toLowerCase();
      r = r.filter((s) => [s.name, s.area, s.intro, ...(s.tags || [])].join(' ').toLowerCase().includes(q));
    }
    r.sort((a, b) => b.solo - a.solo || a.name.localeCompare(b.name, 'ko'));
    count.textContent = r.length ? `${r.length}곳` : '';
    if (!r.length) {
      list.innerHTML = `<div class="empty"><b>이 조건에 맞는 곳이 아직 없어요</b>조건을 하나 풀어 보거나, 아는 곳이 있다면 <a href="/submit.html" style="text-decoration:underline">알려 주세요</a>.</div>`;
      return;
    }
    list.innerHTML = H.sheetHead() + `<div class="sheet">${r.map((s) => H.spaceRow(s, { cat: !state.cat })).join('')}</div>`;
    const p = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => v && p.set(k, v));
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
    paint();
  }

  root.addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    state[c.dataset.k] = c.dataset.v; apply();
  });
  let tm; input.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { state.q = input.value.trim(); apply(); }, 180); });
  apply();
})();
