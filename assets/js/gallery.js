/* 혼플 gallery.js — 플레이스 상세의 사진, 크게 보기, 공유, 지도 펼치기
   페이지에 미리 들어 있는 사진(data/photos.json)에 관리자·호스트가 올린 사진(/api/space/<id>/photos)을 더합니다. */
(function () {
  const root = H.qs('[data-space-id]');
  if (!root) return;
  const id = root.dataset.spaceId;
  const name = root.dataset.spaceName || '';
  const gal = H.qs('[data-gallery]', root);
  const note = H.qs('[data-gal-note]', root);

  let photos = [];
  try { photos = JSON.parse(H.qs('[data-photos]', root)?.textContent || '[]'); } catch { photos = []; }
  const naverLink = note ? (note.querySelector('a[href*="map.naver.com"]')?.outerHTML || '') : '';

  /* ── 사진 출처 한 줄 ── */
  function creditLine(ps) {
    const seen = new Set(); const parts = [];
    ps.forEach((p) => {
      const key = (p.credit || '') + '|' + (p.license || '');
      if (!p.credit || seen.has(key)) return;
      seen.add(key);
      const text = H.esc(p.credit) + (p.license ? ` (${H.esc(p.license)})` : '');
      parts.push(p.source ? `<a href="${H.esc(p.source)}" target="_blank" rel="noopener nofollow">${text}</a>` : text);
    });
    return parts.length ? '사진 ' + parts.join(', ') : '';
  }

  /* ── 사진 영역 그리기 ── */
  const coverInner = H.coverInner(root.dataset.cat || '', +root.dataset.solo || 0, (root.dataset.tags || '').split('|').filter(Boolean));
  function paint() {
    if (!gal) return;
    if (!photos.length) {
      /* 사진이 하나도 남지 않으면 자리 표지로 */
      gal.className = 'gal none';
      gal.innerHTML = `<div class="gal-cover">${coverInner}</div>`;
      if (note) note.innerHTML = naverLink ? '아직 등록된 사진이 없습니다. ' + naverLink : '';
      return;
    }
    const show = photos.slice(0, 3);
    gal.className = 'gal n' + show.length;
    gal.innerHTML = show.map((p, i) => `<button type="button" class="gal-i" data-i="${i}" aria-label="사진 ${i + 1} 크게 보기"><img src="${H.esc(i === 0 ? p.src : (p.thumb || p.src))}" alt="${H.esc(p.alt || name)}" ${i === 0 ? '' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer">${i === 2 && photos.length > 3 ? `<span class="gal-more">사진 ${photos.length}장 모두 보기</span>` : ''}</button>`).join('')
      + (show.length === 1 ? `<span class="gal-side" aria-hidden="true">${coverInner}</span>` : '');
    if (note) {
      const c = creditLine(photos);
      note.innerHTML = c + (c && naverLink ? '<span class="sep"></span>' : '') + naverLink;
    }
    watch();
  }
  /* 불러오지 못한 사진은 빼고 다시 그립니다 */
  function watch() {
    gal.querySelectorAll('.gal-i img').forEach((img) => {
      const drop = () => { photos.splice(+img.closest('[data-i]').dataset.i, 1); paint(); };
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) drop();
      else img.addEventListener('error', drop, { once: true });
    });
  }
  if (gal && photos.length) watch();

  /* ── 올린 사진 더하기 ── */
  (async () => {
    try {
      const r = await fetch('/api/space/' + encodeURIComponent(id) + '/photos', { headers: { Accept: 'application/json' } });
      if (!r.ok) return;
      const j = await r.json();
      if (!j.photos || !j.photos.length) return;
      /* 운영자·호스트가 올린 사진을 앞에, 고정 사진을 뒤에 */
      const have = new Set(j.photos.map((p) => p.src));
      photos = j.photos.concat(photos.filter((p) => !have.has(p.src)));
      paint();
    } catch { /* 사진 API 가 없으면 고정 사진만 */ }
  })();

  /* ── 크게 보기 ── */
  let lb = null, cur = 0, lastFocus = null;
  function capHtml(p) {
    const bits = [];
    if (p.alt) bits.push(H.esc(p.alt));
    if (p.credit) {
      const t = '사진 ' + H.esc(p.credit) + (p.license ? ` (${H.esc(p.license)})` : '');
      bits.push(p.source ? `<a href="${H.esc(p.source)}" target="_blank" rel="noopener nofollow">${t}</a>` : t);
    }
    return bits.join(' — ');
  }
  function show(i) {
    cur = (i + photos.length) % photos.length;
    const p = photos[cur];
    const img = H.qs('.lb-stage img', lb);
    /* 크게 보다가 불러오지 못한 사진을 만나면 빼고 다음 사진으로 */
    img.onerror = () => {
      const i = photos.indexOf(p);
      if (i < 0 || !lb) return;
      photos.splice(i, 1); paint();
      if (!photos.length) close(); else show(i);
    };
    img.src = p.src;
    img.alt = p.alt || name;
    H.qs('[data-lb-n]', lb).textContent = `${cur + 1} / ${photos.length}`;
    H.qs('.lb-cap', lb).innerHTML = capHtml(p);
  }
  function open(i) {
    if (!photos.length) return;
    lastFocus = document.activeElement;
    lb = document.createElement('div');
    lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', name + ' 사진');
    lb.innerHTML = `
      <div class="lb-top"><span data-lb-n></span><button type="button" data-lb-close aria-label="닫기">${H.icon('i-x')}</button></div>
      <div class="lb-stage">
        <img alt="" referrerpolicy="no-referrer">
        ${photos.length > 1 ? `<button type="button" class="lb-nav prev" data-lb-prev aria-label="이전 사진">${H.icon('i-left')}</button><button type="button" class="lb-nav next" data-lb-next aria-label="다음 사진">${H.icon('i-right')}</button>` : ''}
      </div>
      <div class="lb-cap"></div>`;
    document.body.appendChild(lb);
    document.documentElement.style.overflow = 'hidden';
    show(i);
    H.qs('[data-lb-close]', lb).focus();
    H.track('photo', 'open');
    /* 손가락으로 넘기기 */
    let x0 = null;
    lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 48 && photos.length > 1) show(cur + (dx < 0 ? 1 : -1));
    });
    lb.addEventListener('click', (e) => {
      if (e.target.closest('[data-lb-close]') || e.target === lb || e.target.classList.contains('lb-stage')) close();
      else if (e.target.closest('[data-lb-prev]')) show(cur - 1);
      else if (e.target.closest('[data-lb-next]')) show(cur + 1);
    });
  }
  function close() {
    if (!lb) return;
    lb.remove(); lb = null;
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('keydown', (e) => {
    if (!lb) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(cur - 1);
    else if (e.key === 'ArrowRight') show(cur + 1);
    else if (e.key === 'Tab') {
      /* 초점이 사진 창 밖으로 나가지 않게 */
      const f = H.qsa('button, a[href]', lb);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  if (gal) gal.addEventListener('click', (e) => {
    const b = e.target.closest('.gal-i'); if (!b) return;
    open(+b.dataset.i || 0);
  });

  /* ── 공유 ── */
  const shareBtn = H.qs('[data-share]', root);
  if (shareBtn) shareBtn.addEventListener('click', async () => {
    const url = location.origin + location.pathname;
    H.track('share', 'place');
    if (navigator.share) {
      try { await navigator.share({ title: `${name} — 혼플`, text: H.qs('.sp-lede', root)?.textContent || name, url }); } catch { /* 취소 */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); H.toast('주소를 복사했습니다'); }
    catch { H.toast('복사하지 못했습니다. 주소창의 주소를 복사해 주세요'); }
  });

  /* ── 주소 복사 ── */
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); H.toast('주소를 복사했습니다'); }
    catch { H.toast('복사하지 못했습니다'); }
  });

  /* ── 지도 펼치기 (누르기 전에는 바깥 지도를 불러오지 않습니다) ── */
  const map = H.qs('[data-map]', root);
  if (map) H.qs('[data-map-open]', map).addEventListener('click', () => {
    map.innerHTML = `<iframe title="${H.esc(name)} 위치" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen src="https://www.google.com/maps?q=${encodeURIComponent(map.dataset.map)}&output=embed&hl=ko"></iframe>`;
    H.track('map_embed');
  });
})();
