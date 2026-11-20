/* 혼플 place.js — 정적 플레이스 페이지의 익명 후기 영역만 담당 */
(async function () {
  const root = H.qs('[data-space-id]');
  if (!root) return;
  const id = root.dataset.spaceId;
  const name = root.dataset.spaceName || (H.qs('.sp-head h1')?.textContent || '').trim();

  const fEl = H.qs('[data-space-feed]');
  const cEl = H.qs('[data-space-composer]');
  const nEl = H.qs('[data-space-notice]');
  if (!fEl) return;

  /* ── 가고 싶어요 (좋아요) ──
     이 기기에는 저장한 곳 목록으로 남고(/spaces?saved=1), DB가 있으면 공간별 수를 셉니다. */
  const likeBtn = H.qs('[data-like]');
  const LIKED = 'hp_liked';
  const likedList = () => { try { return JSON.parse(localStorage.getItem(LIKED) || '[]'); } catch { return []; } };
  const saveLiked = (on) => {
    const l = likedList().filter((x) => x !== id);
    if (on) l.unshift(id);
    try { localStorage.setItem(LIKED, JSON.stringify(l.slice(0, 300))); } catch { /* */ }
  };
  let likeN = null;
  const paintLike = (on) => {
    if (!likeBtn) return;
    likeBtn.setAttribute('aria-pressed', String(on));
    likeBtn.classList.toggle('on', on);
    H.qs('[data-like-label]', likeBtn).textContent = on ? '저장했어요' : '가고 싶어요';
    H.qs('[data-like-n]', likeBtn).textContent = likeN ? likeN.toLocaleString() : '';
  };
  if (likeBtn) {
    paintLike(likedList().includes(id));
    likeBtn.addEventListener('click', async () => {
      const on = likeBtn.getAttribute('aria-pressed') !== 'true';
      saveLiked(on);
      if (likeN !== null) likeN = Math.max(0, likeN + (on ? 1 : -1));
      paintLike(on);
      H.track(on ? 'like' : 'unlike');
      if (on) H.toast('저장했어요. 플레이스 목록의 ‘저장한 곳’에서 다시 볼 수 있어요');
      if (H.api.demo) return;
      try {
        const r = await fetch('/api/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ space_id: id, vid: H.vid(), on }) });
        if (r.ok) { const j = await r.json(); likeN = j.n; paintLike(j.liked); }
      } catch { /* 이 기기의 저장은 그대로 */ }
    });
  }

  await H.api.ready();
  if (H.api.demo && nEl) nEl.innerHTML = H.demoNotice();

  if (likeBtn && !H.api.demo) {
    fetch('/api/like?space=' + encodeURIComponent(id) + '&vid=' + encodeURIComponent(H.vid()))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || typeof j.n !== 'number') return;
        likeN = j.n;
        /* 서버 기록이 있으면 그쪽을 따르고, 이 기기 목록도 맞춰 둡니다 */
        const local = likedList().includes(id);
        if (j.liked) saveLiked(true);
        else if (local) {
          /* 체험 모드 때 저장했던 곳이면 서버에도 맞춰 둡니다 */
          fetch('/api/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ space_id: id, vid: H.vid(), on: true }) })
            .then((r) => (r.ok ? r.json() : null)).then((k) => { if (k) { likeN = k.n; paintLike(k.liked); } }).catch(() => {});
        }
        paintLike(j.liked || local);
      }).catch(() => {});
  }

  /* 호스트센터에서 저장한 안내가 있으면 정적 본문의 호스트 박스를 바꿉니다.
     (빌드 때 넣은 spaces.json의 host 는 검색엔진용 고정본, D1 쪽이 최신) */
  (async () => {
    const slot = H.qs('[data-host-slot]');
    if (!slot || H.api.demo) return;
    try {
      const r = await fetch('/api/space/' + encodeURIComponent(id) + '/host', { headers: { Accept: 'application/json' } });
      if (!r.ok) return;
      const { host } = await r.json();
      if (!host || !host.note) return;
      const date = (host.updated || host.verified || '').slice(0, 10);
      slot.innerHTML = `<div class="host-box">
        <div class="hb-head">
          <span class="hb-badge">${H.icon('i-check')}호스트 안내</span>
          ${date ? `<span class="hb-date">${H.esc(date)} 수정</span>` : ''}
        </div>
        <h2 style="margin:0 0 10px">${H.esc(host.title || '운영자가 직접 쓴 안내')}</h2>
        ${host.seats || host.hours ? `<dl>
          ${host.seats ? `<dt>1인 좌석</dt><dd>${H.esc(host.seats)}</dd>` : ''}
          ${host.hours ? `<dt>운영 시간</dt><dd>${H.esc(host.hours)}</dd>` : ''}
        </dl>` : ''}
        ${H.esc(host.note).split(/\n{2,}/).map((t) => `<p>${t.replace(/\n/g, '<br>')}</p>`).join('')}
        <div class="hb-foot">이 공간을 운영하는 분이 직접 적은 내용입니다. 혼플은 등급이나 순위를 매기지 않으며, 호스트 등록 여부는 혼자 지수·대화 온도에 영향을 주지 않습니다.${host.link && /^https?:\/\//.test(host.link) ? ` <a href="${H.esc(host.link)}" target="_blank" rel="noopener nofollow">공식 채널</a>` : ''}</div>
      </div>`;
      const h1 = H.qs('.sp-head h1');
      if (h1 && !h1.querySelector('.hb-badge')) h1.insertAdjacentHTML('beforeend', `<span class="hb-badge" title="운영자가 확인한 호스트">${H.icon('i-check')}호스트 확인</span>`);
      const cta = H.qs('[data-host-cta]'); if (cta) cta.remove();
    } catch { /* 안내가 없으면 정적 본문 그대로 */ }
  })();

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
