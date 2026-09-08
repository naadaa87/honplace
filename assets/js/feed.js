/* 혼곳 feed.js — 익명 글 렌더링/작성 공용 */
(function () {
  const F = {};
  window.Feed = F;

  F.postHtml = (p, compact = false) => {
    const replies = (p.replies || []).concat(H.api.seedReplies(p.id));
    const cnt = Math.max(p.comments || 0, replies.length);
    const r = (type, label) => {
      const on = H.api.reacted(p.id, type);
      return `<button class="react${on ? ' on' : ''}" data-act="react" data-type="${type}" data-id="${H.esc(p.id)}" aria-pressed="${on}">${label} <em>${p[type] || 0}</em></button>`;
    };
    const sign = `<div class="sign"><b>— ${H.esc(p.nickname)}</b><span>${H.fmtTime(p.created_at)}</span><span class="cat">${H.CAT_LABEL[p.category] || ''}</span>${p.space_id ? `<a class="space-link" href="/space.html?id=${encodeURIComponent(p.space_id)}">${H.icon('i-pin')}${H.esc(p.space_name || p.space_id)}</a>` : ''}</div>`;
    if (compact) {
      return `<article class="post compact" data-id="${H.esc(p.id)}">
        <p class="body">${H.esc(p.body)}</p>
        ${sign}
        <div class="acts">${r('metoo', '나도 그래요')}<span class="spacer"></span><a class="link" href="/board.html?id=${encodeURIComponent(p.id)}">답글 ${cnt}</a></div>
      </article>`;
    }
    return `<article class="post" data-id="${H.esc(p.id)}" id="p-${H.esc(p.id)}">
      <p class="body">${H.esc(p.body)}</p>
      ${sign}
      <div class="acts">
        ${r('metoo', '나도 그래요')}${r('thanks', '고마워요')}${p.category === 'review' || p.category === 'ask' ? r('going', '다녀올게요') : ''}
        <span class="spacer"></span>
        <button class="link" data-act="toggle-replies">답글 ${cnt}</button>
        <button class="link" data-act="report">신고</button>
      </div>
      <div class="replies hide" data-replies>
        ${replies.map(F.replyHtml).join('')}
        <form class="reply-form" data-reply-form>
          <textarea name="body" maxlength="300" placeholder="이름 없이 답을 남겨요" required></textarea>
          <div class="bar"><span>— <b data-nick></b></span><button class="btn sm" type="submit">답 남기기</button></div>
        </form>
      </div>
    </article>`;
  };

  F.replyHtml = (c) => `<div class="reply"><p>${H.esc(c.body)}</p><div class="sign"><b>— ${H.esc(c.nickname)}</b> ${H.fmtTime(c.created_at)}</div></div>`;

  F.render = (el, posts, opts = {}) => {
    if (!posts.length) {
      el.innerHTML = `<div class="empty"><b>${opts.emptyTitle || '아직 남긴 이야기가 없어요'}</b>${opts.emptyBody || '첫 글은 세 글자여도 괜찮습니다.'}</div>`;
      return;
    }
    el.innerHTML = posts.map((p) => F.postHtml(p, opts.compact)).join('');
    H.qsa('[data-nick]', el).forEach((n) => (n.textContent = H.nick.get()));
  };

  /* 이벤트 위임 */
  F.bind = (el) => {
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const art = b.closest('.post'); const id = art?.dataset.id;
      const act = b.dataset.act;
      if (act === 'react') {
        if (b.classList.contains('on')) { H.toast('이미 남긴 반응이에요'); return; }
        b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
        const em = b.querySelector('em'); em.textContent = (parseInt(em.textContent, 10) || 0) + 1;
        try { await H.api.react(id, b.dataset.type); } catch { H.toast('반응을 남기지 못했어요'); }
      }
      if (act === 'toggle-replies') {
        const box = art.querySelector('[data-replies]'); box.classList.toggle('hide');
        if (!box.classList.contains('hide')) box.querySelector('textarea')?.focus();
      }
      if (act === 'report') {
        if (!confirm('이 글을 신고할까요? 특정인 지목, 연락처 교환, 홍보, 혐오 표현이 신고 대상입니다.')) return;
        try { await H.api.report(id); H.toast('신고를 접수했어요'); } catch { H.toast('접수하지 못했어요'); }
      }
    });
    el.addEventListener('submit', async (e) => {
      const form = e.target.closest('[data-reply-form]'); if (!form) return;
      e.preventDefault();
      const art = form.closest('.post'); const id = art.dataset.id;
      const body = form.body.value.trim(); if (!body) return;
      const btn = form.querySelector('button'); btn.disabled = true;
      try {
        const c = await H.api.comment(id, { nickname: H.nick.get(), body });
        form.insertAdjacentHTML('beforebegin', F.replyHtml(c));
        form.body.value = '';
        const tb = art.querySelector('[data-act="toggle-replies"]');
        const n = (art.querySelectorAll('.reply').length);
        tb.textContent = '답글 ' + n;
        H.toast('답을 남겼어요');
      } catch (err) { H.toast(err.message || '남기지 못했어요'); }
      btn.disabled = false;
    });
  };

  /* 작성기 */
  F.composer = (el, opts = {}) => {
    const cats = opts.categories || ['today', 'story', 'review', 'ask'];
    el.innerHTML = `<form class="composer" data-composer>
      <textarea name="body" maxlength="600" placeholder="${H.esc(opts.placeholder || '이름 없이 남겨요. 세 글자여도 됩니다.')}" required></textarea>
      <div class="sign"><span>—</span><b data-nick>${H.esc(H.nick.get())}</b><button type="button" data-regen>다른 이름으로</button></div>
      <div class="bar">
        ${opts.lockCategory ? `<input type="hidden" name="category" value="${opts.lockCategory}"><span class="tag">${H.CAT_LABEL[opts.lockCategory]}</span>` :
          `<select name="category" aria-label="글 종류">${cats.map((c) => `<option value="${c}">${H.CAT_LABEL[c]}</option>`).join('')}</select>`}
        ${opts.space ? `<span class="picked tag">${H.icon('i-pin', 'i')} ${H.esc(opts.space.name)}<input type="hidden" name="space_id" value="${H.esc(opts.space.id)}"><input type="hidden" name="space_name" value="${H.esc(opts.space.name)}"></span>` :
          `<div class="space-pick"><input type="text" name="space_q" placeholder="다녀온 곳 붙이기" autocomplete="off"><ul class="hide" data-sugg></ul><input type="hidden" name="space_id"><input type="hidden" name="space_name"></div>`}
        <div class="right"><span class="cnt"><span data-cnt>0</span>/600</span><button class="btn lamp sm" type="submit">이름 없이 올리기</button></div>
      </div>
    </form>`;
    const form = el.querySelector('form');
    form.body.addEventListener('input', () => (el.querySelector('[data-cnt]').textContent = form.body.value.length));
    el.querySelector('[data-regen]').addEventListener('click', () => { el.querySelector('[data-nick]').textContent = H.nick.regen(); });

    // 장소 붙이기
    const q = form.querySelector('[name=space_q]');
    if (q) {
      const ul = form.querySelector('[data-sugg]');
      q.addEventListener('input', async () => {
        const v = q.value.trim(); form.space_id.value = ''; form.space_name.value = '';
        if (v.length < 1) { ul.classList.add('hide'); return; }
        const { spaces } = await H.loadSpaces();
        const hits = spaces.filter((s) => s.name.includes(v) || s.area.includes(v)).slice(0, 6);
        if (!hits.length) { ul.classList.add('hide'); return; }
        ul.innerHTML = hits.map((s) => `<li data-id="${H.esc(s.id)}" data-name="${H.esc(s.name)}">${H.esc(s.name)}<small>${H.esc(s.area)}</small></li>`).join('');
        ul.classList.remove('hide');
      });
      ul.addEventListener('click', (e) => {
        const li = e.target.closest('li'); if (!li) return;
        form.space_id.value = li.dataset.id; form.space_name.value = li.dataset.name; q.value = li.dataset.name; ul.classList.add('hide');
      });
      document.addEventListener('click', (e) => { if (!form.contains(e.target)) ul.classList.add('hide'); });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = form.body.value.trim(); if (!body) return;
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      const data = { category: form.category.value, nickname: H.nick.get(), body, space_id: form.space_id?.value || null, space_name: form.space_name?.value || null };
      try {
        const p = await H.api.createPost(data);
        form.body.value = ''; el.querySelector('[data-cnt]').textContent = '0';
        if (q) { q.value = ''; }
        H.toast('올렸어요');
        opts.onPosted && opts.onPosted(p);
      } catch (err) { H.toast(err.message || '올리지 못했어요'); }
      btn.disabled = false;
    });
  };
})();
