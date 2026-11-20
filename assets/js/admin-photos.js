/* 혼플 admin-photos.js — 관리자 ‘사진’ 탭
   지점을 고르고 → 사진을 올리거나, 위키미디어 공용에서 자유 이용 사진을 찾아 등록하거나, 주소로 등록합니다.
   올린 사진은 D1(photos 테이블)에 들어가 지점 페이지와 카드에 바로 보입니다. */
(function () {
  const AP = {};
  window.HPPHOTOS = AP;
  const esc = (s) => H.esc(s);
  let root, api, post;
  let spaces = [], cats = {}, fixed = {}, summary = {}, ready = true;
  let cur = null;           // 고른 지점
  let list = [];            // 고른 지점의 올린 사진
  let q = '', onlyEmpty = false;
  let wm = { id: null, term: '', found: null };   // 위키미디어 공용 검색 결과

  AP.mount = async (el, apiFn, postFn) => {
    root = el; api = apiFn; post = postFn;
    root.innerHTML = '<div class="sk">불러오는 중</div>';
    const [sp, ph, sm] = await Promise.all([
      H.loadSpaces(),
      fetch('/data/photos.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({ photos: {} })),
      api('what=photo-summary').catch(() => ({ ready: false, spaces: [] }))
    ]);
    spaces = sp.spaces; sp.categories.forEach((c) => (cats[c.id] = c.label));
    fixed = ph.photos || {};
    ready = sm.ready !== false;
    summary = Object.fromEntries((sm.spaces || []).map((x) => [x.space_id, x]));
    const want = new URLSearchParams(location.hash.split('?')[1] || '').get('space');
    cur = spaces.find((s) => s.id === want) || null;
    paint();
    if (cur) pick(cur.id);
  };

  const countOf = (id) => (fixed[id] || []).length + ((summary[id]?.n || 0) - (summary[id]?.hidden || 0));

  function paint() {
    const withPhoto = spaces.filter((s) => countOf(s.id) > 0).length;
    const uploaded = Object.values(summary).reduce((a, x) => a + x.n, 0);
    const byHost = Object.values(summary).reduce((a, x) => a + (x.host || 0), 0);
    root.innerHTML = `
      <div class="apx">
        ${ready ? '' : `<div class="ad-err">사진 테이블이 아직 없습니다. Cloudflare → D1 → honplace-db → Console 에서 <code>migrations/004-photos.sql</code> 내용을 실행해 주세요. 실행하기 전에는 사진을 올릴 수 없습니다.</div>`}
        <div class="ad-tiles apx-tiles">
          <div class="ad-tile"><small>사진이 있는 지점</small><b>${withPhoto}</b><span>전체 ${spaces.length}곳 중</span></div>
          <div class="ad-tile"><small>사진이 없는 지점</small><b>${spaces.length - withPhoto}</b><span>아래에서 골라 채워 주세요</span></div>
          <div class="ad-tile"><small>올린 사진</small><b>${uploaded}</b><span>호스트가 올린 것 ${byHost}장</span></div>
        </div>
        <p class="muted small apx-rule">직접 찍은 사진, 가게에서 받은 사진, 자유 이용이 허락된 사진(위키미디어 공용·공공누리)만 올려 주세요. 네이버 지도·블로그·인스타그램의 사진은 주인이 따로 있어 그대로 가져다 쓸 수 없습니다.</p>
        <div class="apx-cols">
          <div class="apx-list">
            <input type="search" data-q placeholder="지점 이름이나 동네" value="${esc(q)}" aria-label="지점 찾기">
            <label class="apx-chk"><input type="checkbox" data-empty${onlyEmpty ? ' checked' : ''}> 사진이 없는 곳만</label>
            <div class="apx-items" data-items></div>
          </div>
          <div class="apx-panel" data-panel><div class="empty"><b>지점을 골라 주세요</b>왼쪽에서 지점을 누르면 사진을 보고 올릴 수 있습니다.</div></div>
        </div>
      </div>`;
    paintItems();
    H.qs('[data-q]', root).addEventListener('input', (e) => { q = e.target.value.trim(); paintItems(); });
    H.qs('[data-empty]', root).addEventListener('change', (e) => { onlyEmpty = e.target.checked; paintItems(); });
    H.qs('[data-items]', root).addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) pick(b.dataset.id); });
  }

  function paintItems() {
    const el = H.qs('[data-items]', root);
    let r = spaces.slice();
    if (q) { const k = q.toLowerCase(); r = r.filter((s) => (s.name + ' ' + s.area).toLowerCase().includes(k)); }
    if (onlyEmpty) r = r.filter((s) => !countOf(s.id));
    r.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'place' ? -1 : 1) || a.name.localeCompare(b.name, 'ko'));
    el.innerHTML = r.length ? r.map((s) => {
      const n = countOf(s.id);
      return `<button type="button" class="apx-it${cur && cur.id === s.id ? ' on' : ''}" data-id="${esc(s.id)}"><span><b>${esc(s.name)}</b><small>${esc(cats[s.cat] || '')} · ${esc(s.area)}</small></span><em class="${n ? 'has' : ''}">${n ? n + '장' : '없음'}</em></button>`;
    }).join('') : '<p class="muted small" style="padding:12px 4px">맞는 지점이 없습니다.</p>';
  }

  async function pick(id) {
    cur = spaces.find((s) => s.id === id); if (!cur) return;
    H.qsa('.apx-it', root).forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    const panel = H.qs('[data-panel]', root);
    panel.innerHTML = '<div class="sk">불러오는 중</div>';
    try { list = (await api('what=photos&space=' + encodeURIComponent(id))).photos || []; }
    catch (e) { list = []; }
    paintPanel();
    if (window.innerWidth < 900) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const fig = (p, i, isFixed) => `
    <figure class="apx-ph${p.hidden ? ' hid' : ''}" ${isFixed ? '' : `data-ph="${esc(p.id)}"`}>
      <img src="${esc(p.thumb || p.src)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <figcaption>
        <span class="apx-meta">${isFixed ? '<i class="tag">고정</i>' : p.by === 'host' ? '<i class="tag kind">호스트</i>' : ''}${p.hidden ? '<i class="tag">숨김</i>' : ''}${i === 0 && !p.hidden ? '<i class="tag kind">대표</i>' : ''}</span>
        <span class="apx-cr">${esc(p.credit || '출처 표기 없음')}${p.license ? ` (${esc(p.license)})` : ''}</span>
        ${isFixed ? '' : `<span class="apx-act">
          ${i === 0 || p.hidden ? '' : '<button type="button" class="linkbtn" data-cover>대표로</button>'}
          <button type="button" class="linkbtn" data-hide>${p.hidden ? '다시 보이기' : '숨기기'}</button>
          <button type="button" class="linkbtn" data-del>지우기</button>
        </span>`}
      </figcaption>
    </figure>`;

  function paintPanel() {
    const panel = H.qs('[data-panel]', root);
    const fx = fixed[cur.id] || [];
    const urlKind = list.filter((p) => p.kind === 'url' && !p.hidden);
    panel.innerHTML = `
      <div class="apx-h">
        <div><h3>${esc(cur.name)}</h3><p class="muted small">${esc(cats[cur.cat] || '')} · ${esc(cur.area)}${cur.addr ? ' · ' + esc(cur.addr) : ''}</p></div>
        <a class="btn ghost sm" href="/place/${encodeURIComponent(cur.id)}" target="_blank" rel="noopener">지점 페이지</a>
      </div>

      <h4>지금 보이는 사진 <small>${list.filter((p) => !p.hidden).length + fx.length}장</small></h4>
      ${list.length || fx.length ? `<div class="apx-grid">${list.map((p, i) => fig(p, i, false)).join('')}${fx.map((p, i) => fig(p, list.length ? 1 : i, true)).join('')}</div>` : '<p class="muted small">아직 사진이 없습니다. 아래 세 가지 방법 중 하나로 등록해 주세요.</p>'}
      ${fx.length ? '<p class="muted small">‘고정’ 사진은 <code>data/photos.json</code> 에 적힌 것이라 여기서는 지울 수 없습니다(플레이스 데이터와 함께 관리).</p>' : ''}

      <details class="apx-box" open>
        <summary>사진 파일 올리기</summary>
        <form data-up>
          <input type="file" name="files" accept="image/jpeg,image/png,image/webp,image/*" multiple required>
          <div class="apx-row">
            <label>사진 설명 <small>선택</small><input type="text" name="alt" maxlength="80" placeholder="예: 카운터 자리"></label>
            <label>출처 표기<input type="text" name="credit" maxlength="60" value="혼플" placeholder="찍은 사람이나 제공처"></label>
          </div>
          <label class="apx-chk"><input type="checkbox" name="rights" required> 직접 찍었거나, 가게에서 받았거나, 사용할 권리가 있는 사진입니다</label>
          <div class="apx-sub"><button class="btn sm" type="submit">올리기</button><span class="muted small" data-up-msg>긴 변 1600px 로 줄여서 올립니다. 한 번에 여러 장을 고를 수 있습니다.</span></div>
        </form>
      </details>

      <details class="apx-box">
        <summary>위키미디어 공용에서 찾기 <small>공공장소·미술관·공원 등 자유 이용 사진</small></summary>
        <form data-wm>
          <div class="apx-sub"><input type="search" name="q" value="${esc(cur.mapq || cur.name)}" placeholder="한글 이름이나 영문 이름" aria-label="검색어"><button class="btn sm" type="submit">찾기</button></div>
          <p class="muted small">한글 이름으로 안 나오면 영문 이름으로 찾아보세요(예: Deoksugung, Seoul Forest). 누르면 사진·작성자·라이선스가 함께 등록되고, 지점 페이지에 출처가 표시됩니다.</p>
        </form>
        <div class="apx-wm" data-wm-out></div>
      </details>

      <details class="apx-box">
        <summary>사진 주소로 등록 <small>공공누리 등 다른 곳의 자유 이용 사진</small></summary>
        <form data-url>
          <label>사진 주소<input type="url" name="url" placeholder="https://…" required></label>
          <label>작은 그림 주소 <small>선택</small><input type="url" name="thumb_url" placeholder="https://…"></label>
          <div class="apx-row">
            <label>사진 설명 <small>선택</small><input type="text" name="alt" maxlength="80"></label>
            <label>출처 표기<input type="text" name="credit" maxlength="60" placeholder="예: 한국관광공사" required></label>
          </div>
          <div class="apx-row">
            <label>라이선스<input type="text" name="license" maxlength="40" placeholder="예: 공공누리 1유형, CC BY 4.0"></label>
            <label>출처 페이지 <small>선택</small><input type="url" name="source" placeholder="https://…"></label>
          </div>
          <div class="apx-sub"><button class="btn sm" type="submit">등록</button></div>
        </form>
      </details>

      ${urlKind.length ? `<p class="apx-json"><button type="button" class="btn ghost sm" data-json>photos.json 조각 복사</button><span class="muted small">주소로 등록한 사진을 <code>data/photos.json</code> 에 붙여 넣고 빌드하면 검색엔진과 공유 미리보기에도 쓰입니다.</span></p>` : ''}`;
    bindPanel(panel);
  }

  const refreshCount = () => {
    summary[cur.id] = { space_id: cur.id, n: list.length, hidden: list.filter((p) => p.hidden).length, host: list.filter((p) => p.by === 'host').length };
    try { sessionStorage.removeItem('hp_covers'); } catch { /* */ }
    paintItems();
  };
  const add = async (body) => {
    const r = await post(Object.assign({ action: 'photo-add', space_id: cur.id }, body));
    if (r && r.photo) list.push(r.photo);
    return r;
  };

  function bindPanel(panel) {
    /* 지금 보이는 사진: 대표·숨김·삭제
       (panel 은 다시 그릴 때마다 같은 요소라, 겹쳐 붙지 않게 onclick 으로 하나만 둡니다) */
    panel.onclick = async (e) => {
      const f = e.target.closest('[data-ph]'); if (!f) return;
      const id = f.dataset.ph;
      try {
        if (e.target.closest('[data-cover]')) {
          await post({ action: 'photo-cover', id });
          const p = list.find((x) => x.id === id); list = [p, ...list.filter((x) => x.id !== id)];
          H.toast('대표 사진으로 바꿨습니다');
        } else if (e.target.closest('[data-hide]')) {
          const p = list.find((x) => x.id === id);
          await post({ action: 'photo-hide', id, hidden: !p.hidden }); p.hidden = !p.hidden;
          H.toast(p.hidden ? '숨겼습니다' : '다시 보이게 했습니다');
        } else if (e.target.closest('[data-del]')) {
          if (!confirm('이 사진을 지웁니다. 되돌릴 수 없습니다.')) return;
          await post({ action: 'photo-delete', id }); list = list.filter((x) => x.id !== id);
          H.toast('지웠습니다');
        } else return;
        refreshCount(); paintPanel();
      } catch (err) { H.toast(err.message); }
    };

    /* 파일 올리기 */
    const up = H.qs('[data-up]', panel);
    up.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = H.qs('[data-up-msg]', up), btn = up.querySelector('button[type="submit"]');
      const files = [...up.files.files];
      if (!files.length) return;
      btn.disabled = true;
      let ok = 0; const fails = [];
      for (let i = 0; i < files.length; i++) {
        msg.textContent = `${i + 1} / ${files.length} 올리는 중…`;
        try {
          const img = await H.shrinkImage(files[i]);
          await add({ kind: 'upload', ...img, alt: up.alt.value.trim(), credit: up.credit.value.trim() || '혼플' });
          ok++;
        } catch (err) { fails.push(`${files[i].name}: ${err.message}`); }
      }
      btn.disabled = false;
      refreshCount(); paintPanel();
      H.toast(ok ? `${ok}장 올렸습니다${fails.length ? ` · ${fails.length}장 실패` : ''}` : '올리지 못했습니다');
      if (fails.length) H.qs('[data-up-msg]', panel).textContent = fails.join(' / ');
    });

    /* 주소로 등록 */
    const uf = H.qs('[data-url]', panel);
    uf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(uf).entries());
      try { await add({ kind: 'url', ...v }); refreshCount(); paintPanel(); H.toast('등록했습니다'); }
      catch (err) { H.toast(err.message); }
    });

    /* 위키미디어 공용 */
    const wf = H.qs('[data-wm]', panel), out = H.qs('[data-wm-out]', panel);
    const paintWm = () => {
      const found = wm.found || [];
      const have = new Set(list.map((p) => p.source));
      out.innerHTML = found.length ? `<div class="apx-grid">${found.map((c, i) => `
        <figure class="apx-ph" data-c="${i}">
          <a href="${esc(c.page)}" target="_blank" rel="noopener" title="위키미디어 공용에서 보기"><img src="${esc(c.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>
          <figcaption>
            <span class="apx-cr"><b>${esc(c.license || '라이선스 확인 필요')}</b> · ${esc(c.artist || '작성자 미상')}</span>
            <span class="apx-cr muted">${esc(c.name)} · ${c.w}×${c.h}</span>
            <span class="apx-act">${have.has(c.page) ? '<span class="muted">등록됨</span>' : c.license ? '<button type="button" class="btn sm" data-reg>이 사진 등록</button>' : '<span class="muted">라이선스 정보가 없어 등록할 수 없습니다</span>'}</span>
          </figcaption>
        </figure>`).join('')}</div>` : '<p class="muted small">찾지 못했습니다. 영문 이름이나 다른 표기로 다시 찾아보세요.</p>';
    };
    if (wm.id === cur.id && wm.found) { wf.closest('details').open = true; wf.q.value = wm.term; paintWm(); }
    wf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const term = wf.q.value.trim(); if (!term) return;
      out.innerHTML = '<p class="muted small">찾는 중…</p>';
      try { wm = { id: cur.id, term, found: await searchCommons(term) }; paintWm(); }
      catch { out.innerHTML = '<p class="form-err">위키미디어 공용에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p>'; }
    });
    out.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-reg]'); if (!b) return;
      const c = wm.found[+b.closest('[data-c]').dataset.c];
      b.disabled = true;
      try {
        await add({ kind: 'url', url: c.src, thumb_url: c.thumb, alt: cur.name, credit: (c.artist ? c.artist + ' / ' : '') + '위키미디어 공용', license: c.license, source: c.page, w: c.w, h: c.h });
        refreshCount(); paintPanel();
        H.toast('등록했습니다. 지점 페이지에 출처와 함께 표시됩니다');
      } catch (err) { b.disabled = false; H.toast(err.message); }
    });

    const jb = H.qs('[data-json]', panel);
    if (jb) jb.onclick = () => {
      const arr = list.filter((p) => p.kind === 'url' && !p.hidden).map((p) => ({ src: p.src, thumb: p.thumb, alt: p.alt || cur.name, credit: p.credit, ...(p.license ? { license: p.license } : {}), ...(p.source ? { source: p.source } : {}) }));
      const text = `"${cur.id}": ${JSON.stringify(arr, null, 2)},`;
      navigator.clipboard.writeText(text).then(() => H.toast('복사했습니다. data/photos.json 의 "photos" 안에 붙여 넣으세요')).catch(() => H.toast('복사하지 못했습니다'));
    };
  }

  /* ── 위키미디어 공용 검색 ──
     공용에는 자유 이용이 허락된 파일만 올라옵니다. 작성자와 라이선스를 함께 받아 출처로 표기합니다. */
  const plain = (html) => (new DOMParser().parseFromString(String(html || ''), 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();
  async function searchCommons(term) {
    const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
      action: 'query', format: 'json', origin: '*',
      generator: 'search', gsrnamespace: '6', gsrsearch: term + ' filetype:bitmap', gsrlimit: '24',
      prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '500',
      iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription'
    });
    const j = await fetch(u).then((r) => { if (!r.ok) throw new Error('commons'); return r.json(); });
    return Object.values((j.query && j.query.pages) || {})
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .map((p) => {
        const ii = p.imageinfo && p.imageinfo[0]; if (!ii) return null;
        if (!/^image\/(jpeg|png|webp)$/.test(ii.mime || '')) return null;
        if (Math.max(ii.width || 0, ii.height || 0) < 900) return null;
        const m = ii.extmetadata || {};
        const name = String(p.title || '').replace(/^File:/, '');
        const fp = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(name.replace(/ /g, '_'));
        const sc = Math.min(1, 960 / (ii.width || 960));
        return {
          name, page: ii.descriptionurl,
          thumb: ii.thumburl || fp + '?width=500',
          src: fp + '?width=960',
          w: Math.round((ii.width || 0) * sc), h: Math.round((ii.height || 0) * sc),
          license: plain(m.LicenseShortName && m.LicenseShortName.value).slice(0, 40),
          artist: plain(m.Artist && m.Artist.value).slice(0, 40)
        };
      }).filter(Boolean);
  }
  AP._searchCommons = searchCommons;
})();
