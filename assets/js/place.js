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
