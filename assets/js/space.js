/* 혼곳 space.js — 공간 상세 */
(async function () {
  const id = H.param('id');
  const { spaces } = await H.loadSpaces();
  const s = spaces.find((x) => x.id === id);
  const root = H.qs('[data-space]');
  if (!s) {
    root.innerHTML = `<div class="nf"><h1>이 곳은 비어 있어요.</h1><p>찾으시는 곳이 아직 등록되지 않았거나 주소가 바뀌었습니다.</p><a class="btn" href="/spaces.html">곳 찾기로 가기</a></div>`;
    H.qsa('[data-space-section]').forEach((el) => el.classList.add('hide'));
    return;
  }
  const c = H.CATS[s.cat] || {};
  document.title = `${s.name} — 혼곳`;
  H.qs('meta[name=description]')?.setAttribute('content', s.intro);
  const q = encodeURIComponent(s.mapq || s.name);
  const naverUrl = 'https://map.naver.com/p/search/' + q;
  const googleUrl = 'https://www.google.com/maps/search/?api=1&query=' + q;

  root.innerHTML = `
    <div class="sp-head">
      <div class="cat"><a href="/spaces.html?cat=${s.cat}">${H.esc(c.label || '')}</a>${s.kind === 'type' ? '<span class="tag kind">유형</span>' : ''}</div>
      <h1>${H.esc(s.name)}</h1>
      <div class="area">${H.esc(s.area)}</div>
      ${s.addr ? `<div class="addr">${H.esc(s.addr)}</div>` : ''}
    </div>
    <div class="facts">
      <div class="f"><small>혼자 지수</small>${H.seats(s.solo, true)}</div>
      <div class="f"><small>대화 온도</small>${H.talk(s.talk)}</div>
      <div class="f"><small>비용</small><b class="num">${H.esc(s.price)}</b></div>
      <div class="f"><small>어울리는 시간</small><b>${s.time.map((t) => H.TIME[t]).join(', ')}</b></div>
    </div>
    <div class="sp-body">
      <h2>어떤 곳인가요</h2><p>${H.esc(s.intro)}</p>
      <h2>분위기와 문화</h2><p>${H.esc(s.culture)}</p>
      <h2>처음 가면</h2><p>${H.esc(s.first)}</p>
      ${s.notes?.length ? `<h2>알아 두면 좋아요</h2><ul>${s.notes.map((n) => `<li>${H.esc(n)}</li>`).join('')}</ul>` : ''}
      <div class="tags">${(s.tags || []).map((t) => `<span class="tag">${H.esc(t)}</span>`).join('')}</div>
      <div class="actions">
        <a class="btn" href="${naverUrl}" target="_blank" rel="noopener">${H.icon('i-pin')}네이버지도${s.kind === 'type' ? '에서 찾기' : ''}</a>
        <a class="btn" href="${googleUrl}" target="_blank" rel="noopener">${H.icon('i-pin')}구글지도${s.kind === 'type' ? '에서 찾기' : ''}</a>
        <a class="btn ghost" href="/submit.html?fix=${encodeURIComponent(s.id)}">정보 수정 제안</a>
      </div>
      ${s.kind === 'type' ? '' : `<p class="small muted" style="margin-top:10px">지도를 누르면 네이버지도·구글지도에서 위치와 운영시간을 바로 확인할 수 있습니다.</p>`}
    </div>`;

  /* 후기 */
  const fEl = H.qs('[data-space-feed]');
  const cEl = H.qs('[data-space-composer]');
  const nEl = H.qs('[data-space-notice]');
  await H.api.ready();
  if (H.api.demo) nEl.innerHTML = H.demoNotice();
  async function load() {
    const posts = await H.api.listPosts({ space: s.id, limit: 50 });
    Feed.render(fEl, posts, { emptyTitle: '아직 이곳의 후기가 없어요', emptyBody: '혼자 다녀온 이야기를 이름 없이 남겨 주세요.' });
  }
  Feed.composer(cEl, { lockCategory: 'review', space: { id: s.id, name: s.name }, placeholder: '혼자 다녀온 날은 어땠나요. 어색했던 순간, 좋았던 자리, 다음에 갈 사람에게 해 주고 싶은 말.', onPosted: load });
  Feed.bind(fEl);
  await load();

  /* 같은 카테고리 다른 곳 */
  const more = spaces.filter((x) => x.cat === s.cat && x.id !== s.id).slice(0, 3);
  const mEl = H.qs('[data-space-more]');
  if (more.length) mEl.innerHTML = `<h2>비슷한 곳</h2><div class="sheet">${more.map((x) => H.spaceRow(x, { cat: false })).join('')}</div><p style="margin:14px 0 0"><a class="btn ghost sm" href="/spaces.html?cat=${s.cat}">${H.esc(c.label)} 전부 보기</a></p>`;
})();
