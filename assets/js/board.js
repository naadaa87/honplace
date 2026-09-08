/* 혼곳 board.js */
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
  await load();
})();
