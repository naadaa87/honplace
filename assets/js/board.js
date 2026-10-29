/* 혼플 board.js */
(async function () {
  await H.loadSpaces();
  const tabs = H.qs('[data-tabs]');
  const feed = H.qs('[data-feed]');
  const comp = H.qs('[data-composer-slot]');
  const notice = H.qs('[data-notice]');
  const single = H.param('id');
  let cat = H.param('cat') || '';

  await H.api.ready();
  if (H.api.demo) notice.innerHTML = H.demoNotice();

  if (single) {
    // 단일 글
    tabs.classList.add('hide'); comp.classList.add('hide');
    const p = await H.api.getPost(single);
    if (!p) { feed.innerHTML = `<div class="empty"><b>이 글은 이제 여기 없어요</b>지워졌거나 주소가 바뀌었습니다. <a href="/board.html" style="text-decoration:underline">게시판으로</a></div>`; return; }
    Feed.render(feed, [p]);
    Feed.bind(feed);
    feed.querySelector('[data-replies]')?.classList.remove('hide');
    H.qs('[data-back]').classList.remove('hide');
    return;
  }

  tabs.innerHTML = [['', '전체'], ['today', '오늘 한마디'], ['story', '그냥 이야기'], ['review', '다녀왔어요'], ['ask', '어디 갈까요']]
    .map(([v, l]) => `<button class="chip" data-v="${v}" aria-pressed="${String(cat === v)}">${l}</button>`).join('');
  tabs.addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    cat = c.dataset.v;
    H.qsa('.chip', tabs).forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    history.replaceState(null, '', '/board.html' + (cat ? '?cat=' + cat : ''));
    load();
  });

  async function load() {
    feed.innerHTML = '<div class="sk">불러오는 중</div>';
    try {
      const posts = await H.api.listPosts({ category: cat, limit: 60 });
      Feed.render(feed, posts);
    } catch { feed.innerHTML = '<div class="sk">이야기를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</div>'; }
  }
  Feed.composer(comp, { onPosted: load });
  Feed.bind(feed);

  /* 오늘의 질문 — 누르면 작성기에 질문을 인용해 넣고 '오늘 한마디'로 맞춥니다 */
  const tq = H.qs('[data-today-q]');
  if (tq) {
    const txt = H.qs('[data-today-q-text]', tq)?.textContent?.trim() || '';
    const btn = H.qs('[data-answer]', tq);
    /* 빌드 시점이 아니라 오늘 날짜의 질문으로 바꿔 둡니다 */
    fetch('/data/prompts.json', { cache: 'no-cache' }).then((r) => r.json()).then(({ prompts }) => {
      const d = new Date(); const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
      const q = prompts[doy % prompts.length]; if (q) H.qs('[data-today-q-text]', tq).textContent = q;
    }).catch(() => {});
    btn.onclick = () => {
      const form = comp.querySelector('form'); if (!form) return;
      const q = H.qs('[data-today-q-text]', tq).textContent.trim() || txt;
      if (form.category && form.category.tagName === 'SELECT') form.category.value = 'today';
      if (!form.body.value.trim()) form.body.value = `Q. ${q}\n`;
      form.body.focus(); form.body.setSelectionRange(form.body.value.length, form.body.value.length);
      form.body.dispatchEvent(new Event('input'));
      comp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }

  /* 이번 주 다녀온 곳 — 후기가 달린 플레이스 (DB가 있을 때만) */
  const ws = H.qs('[data-week-spaces]');
  if (ws && !H.api.demo) try {
    const r = await fetch('/api/stats/spaces?days=7');
    if (r.ok) {
      const { spaces } = await r.json();
      if (spaces && spaces.length) {
        ws.innerHTML = `<small>이번 주 다녀왔다는 곳</small><div class="chips">${spaces.map((x) =>
          `<a class="chip" href="/place/${encodeURIComponent(x.space_id)}">${H.esc(x.space_name || x.space_id)} <span class="n">${x.n}</span></a>`).join('')}</div>`;
        ws.classList.remove('hide');
      }
    }
  } catch { /* 없으면 숨긴 채로 */ }

  await load();
})();
