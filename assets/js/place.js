/* 혼플 place.js — 정적 플레이스 페이지의 익명 후기 영역만 담당 */
(async function () {
  const root = H.qs('[data-space-id]');
  if (!root) return;
  const id = root.dataset.spaceId;
  const name = (H.qs('.sp-head h1')?.textContent || '').trim();

  const fEl = H.qs('[data-space-feed]');
  const cEl = H.qs('[data-space-composer]');
  const nEl = H.qs('[data-space-notice]');
  if (!fEl) return;

  await H.api.ready();
  if (H.api.demo && nEl) nEl.innerHTML = H.demoNotice();

  async function load() {
    const posts = await H.api.listPosts({ space: id, limit: 50 });
    Feed.render(fEl, posts, {
      emptyTitle: '아직 이곳의 후기가 없어요',
      emptyBody: '혼자 다녀온 이야기를 이름 없이 남겨 주세요.'
    });
  }

  Feed.composer(cEl, {
    lockCategory: 'review',
    space: { id, name },
    placeholder: '혼자 다녀온 날은 어땠나요. 어색했던 순간, 좋았던 자리, 다음에 갈 사람에게 해 주고 싶은 말.',
    onPosted: load
  });
  Feed.bind(fEl);
  await load();
})();
