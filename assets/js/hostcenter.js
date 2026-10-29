/* 혼플 hostcenter.js — 인증된 호스트의 작업 공간
   키는 이 기기의 localStorage 에만 저장합니다. 서버에는 Authorization 헤더로만 보냅니다. */
(async function () {
  const root = H.qs('[data-hc]');
  if (!root) return;
  const KEY = 'hp_host_key';
  const loginEl = H.qs('[data-hc-login]');
  const mainEl = H.qs('[data-hc-main]');
  const form = H.qs('[data-hc-form]');
  const errEl = H.qs('[data-err]', form);

  const CATL = { honsul: '혼술', honbap: '혼밥', cafe: '카페·서점', culture: '영화·전시·공연', play: '혼자 놀기', move: '몸 쓰기', rest: '쉬기', learn: '배우기', social: '가벼운 모임' };
  const PK = { review: '후기', question: '질문', today: '오늘', tip: '팁', place: '추천' };

  let key = '';
  try { key = localStorage.getItem(KEY) || ''; } catch { key = ''; }
  let me = null;      // { host, stats }
  let posts = [];     // 내 공간의 글

  /* ── API ─────────────────────────────── */
  async function call(path, opt = {}) {
    const r = await fetch(path, Object.assign({}, opt, {
      headers: Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, opt.headers || {})
    }));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || '요청에 실패했습니다'); e.status = r.status; throw e; }
    return j;
  }

  const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hide'); };
  const hideErr = () => errEl.classList.add('hide');
  const fmtDate = (iso) => iso ? String(iso).slice(0, 10).replace(/-/g, '.') : '';
  const nl2p = (t) => H.esc(t || '').split(/\n{2,}/).map((x) => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('');

  /* ── 로그인 ──────────────────────────── */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErr();
    const k = form.key.value.trim();
    if (!/^hk-[a-z0-9]{10,}$/i.test(k)) return showErr('키 형식이 맞지 않습니다. hk- 로 시작하는 키를 그대로 붙여 넣어 주세요.');
    key = k;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await enter();
      try { localStorage.setItem(KEY, key); } catch { /* 저장이 안 되는 브라우저면 이번만 */ }
    } catch (err) {
      key = '';
      showErr(err.status === 503
        ? '데이터베이스가 아직 연결되어 있지 않습니다. 운영자에게 문의해 주세요.'
        : (err.message || '들어갈 수 없습니다'));
    }
    btn.disabled = false;
  });

  async function enter() {
    me = await call('/api/host/me');
    loginEl.classList.add('hide');
    mainEl.classList.remove('hide');
    render('guide');
  }

  function leave() {
    key = ''; me = null; posts = [];
    try { localStorage.removeItem(KEY); } catch { /* */ }
    mainEl.classList.add('hide'); mainEl.innerHTML = '';
    loginEl.classList.remove('hide');
    form.key.value = '';
    H.toast('이 기기에서 키를 지웠습니다');
  }

  /* ── 화면 ────────────────────────────── */
  let tab = 'guide';
  function render(t) {
    if (t) tab = t;
    const h = me.host, st = me.stats;
    const pub = h.pub || {};
    mainEl.innerHTML = `
      <div class="hc-head">
        <div>
          <div class="cat">${H.esc(CATL[h.cat] || '')}${h.area ? ` · ${H.esc(h.area)}` : ''}</div>
          <h2>${H.esc(h.space_name)}<span class="hb-badge">${H.icon('i-check')}인증 호스트</span></h2>
          <p class="small muted">${h.verified_at ? `${fmtDate(h.verified_at)} 인증` : ''}${h.owner_name ? ` · 담당 ${H.esc(h.owner_name)}` : ''}</p>
        </div>
        <div class="hc-head-b">
          ${h.space_id ? `<a class="btn ghost sm" href="/place/${encodeURIComponent(h.space_id)}" target="_blank" rel="noopener">공간 페이지 보기</a>` : ''}
          <button class="btn ghost sm" data-leave>나가기</button>
        </div>
      </div>

      ${!h.space_id ? `<div class="notice">${H.icon('i-info')}<div>아직 공간 페이지가 만들어지지 않았습니다. 운영자가 등록을 마치면 안내와 후기가 공간 페이지에 연결됩니다. 안내는 지금 미리 써 두셔도 됩니다.</div></div>` : ''}

      <div class="ad-tiles hc-tiles">
        <div class="ad-tile"><small>남겨진 후기</small><b>${st.posts}</b><span>${st.last ? '마지막 ' + H.fmtTime(st.last) : '아직 없음'}</span></div>
        <div class="ad-tile"><small>받은 반응</small><b>${st.reactions}</b><span>나도·고마워·가볼게</span></div>
        <div class="ad-tile"><small>내가 단 답글</small><b>${st.hostReplies}</b><span>전체 답글 ${st.replies}</span></div>
        <div class="ad-tile"><small>호스트 안내</small><b>${pub.note ? '게시 중' : '없음'}</b><span>${pub.updated_at ? fmtDate(pub.updated_at) + ' 수정' : '아직 쓰지 않음'}</span></div>
      </div>

      <div class="chips hc-tabs">
        <button class="chip${tab === 'guide' ? ' on' : ''}" data-tab="guide">호스트 안내</button>
        <button class="chip${tab === 'reviews' ? ' on' : ''}" data-tab="reviews">후기와 답글${st.posts ? ` <em>${st.posts}</em>` : ''}</button>
        <button class="chip${tab === 'help' ? ' on' : ''}" data-tab="help">잘 쓰는 법</button>
      </div>

      <div data-hc-body>${tab === 'guide' ? viewGuide() : tab === 'reviews' ? '<p class="muted small">불러오는 중…</p>' : viewHelp()}</div>
    `;
    H.qs('[data-leave]', mainEl).onclick = () => { if (confirm('이 기기에서 호스트 키를 지우고 나갑니다. 다시 들어오려면 키가 필요합니다.')) leave(); };
    H.qsa('[data-tab]', mainEl).forEach((b) => b.onclick = () => render(b.dataset.tab));
    if (tab === 'guide') bindGuide();
    if (tab === 'reviews') loadReviews();
  }

  /* ── 호스트 안내 ─────────────────────── */
  function viewGuide() {
    const pub = me.host.pub || {};
    return `
      <div class="hc-grid">
        <form class="form hc-form" data-pub-form>
          <div class="field">
            <label for="p-title">제목 <small>선택</small></label>
            <input id="p-title" type="text" name="title" maxlength="40" value="${H.esc(pub.title || '')}" placeholder="운영자가 직접 쓴 안내">
          </div>
          <div class="grid2">
            <div class="field">
              <label for="p-seats">1인 좌석</label>
              <input id="p-seats" type="text" name="seats" maxlength="80" value="${H.esc(pub.seats || '')}" placeholder="예: 카운터 6석, 창가 1인석 2자리">
            </div>
            <div class="field">
              <label for="p-hours">운영 시간</label>
              <input id="p-hours" type="text" name="hours" maxlength="120" value="${H.esc(pub.hours || '')}" placeholder="예: 화–일 18:00–01:00, 월 휴무">
            </div>
          </div>
          <div class="field">
            <label for="p-note">혼자 오는 손님을 위한 안내 <span class="req">필수</span></label>
            <textarea id="p-note" name="note" maxlength="1200" rows="9" required placeholder="혼자 온 손님이 문을 열기 전에 알고 싶은 것을 적어 주세요. 빈 줄로 문단을 나눌 수 있습니다.">${H.esc(pub.note || '')}</textarea>
            <p class="help"><span data-count>0</span> / 1200자 · 20자 이상</p>
          </div>
          <div class="field">
            <label for="p-link">공식 채널 <small>선택</small></label>
            <input id="p-link" type="text" name="link" maxlength="300" value="${H.esc(pub.link || '')}" placeholder="https:// 로 시작하는 인스타그램·홈페이지 주소">
            <p class="help">안내 본문과 답글에는 연락처와 링크를 넣을 수 없습니다. 링크는 이 칸에만 넣어 주세요.</p>
          </div>
          <div class="submit">
            <button class="btn lamp" type="submit">저장하고 공간 페이지에 반영</button>
            <button class="btn ghost" type="button" data-preview>미리 보기</button>
          </div>
          <p class="form-err hide" data-pub-err></p>
        </form>

        <aside class="hc-aside">
          <div class="host-not" style="margin:0">
            <h2 class="sec">이렇게 쓰면 손님이 옵니다</h2>
            <p><b>1인 좌석이 어디에 몇 개인지.</b> 카운터인지 창가인지, 벽을 보는 자리인지. 혼자 온 손님이 가장 먼저 보는 문장입니다.</p>
            <p><b>혼자 와도 편한 시간대.</b> “평일 7시 전에는 거의 혼자 오십니다” 같은 한 줄이 “언제든 환영합니다”보다 훨씬 힘이 셉니다.</p>
            <p><b>주문하는 법과 머물 수 있는 시간.</b> QR 주문인지, 자리에서 부르는지, 한 잔으로 얼마나 있어도 되는지.</p>
            <p><b>말을 거는지, 안 거는지.</b> 둘 다 괜찮습니다. 손님이 미리 알고 고를 수 있게만 해 주세요.</p>
            <p>‘최고’ ‘강추’ 같은 말은 저장되지 않습니다. 사실만 적어도 충분히 매력적입니다.</p>
          </div>
        </aside>
      </div>
      <div class="hide" data-preview-box></div>
    `;
  }

  function bindGuide() {
    const f = H.qs('[data-pub-form]', mainEl);
    const err = H.qs('[data-pub-err]', f);
    const cnt = H.qs('[data-count]', f);
    const note = f.note;
    const upd = () => (cnt.textContent = note.value.length);
    note.addEventListener('input', upd); upd();

    H.qs('[data-preview]', f).onclick = () => {
      const box = H.qs('[data-preview-box]', mainEl);
      const v = Object.fromEntries(new FormData(f).entries());
      box.classList.remove('hide');
      box.innerHTML = `
        <p class="small muted" style="margin:26px 0 8px">공간 페이지에는 이렇게 보입니다</p>
        <div class="host-box">
          <div class="hb-head"><span class="hb-badge">${H.icon('i-check')}호스트 안내</span><span class="hb-date">${fmtDate(new Date().toISOString())} 수정</span></div>
          <h2 style="margin:0 0 10px">${H.esc(v.title || '운영자가 직접 쓴 안내')}</h2>
          ${v.seats || v.hours ? `<dl>${v.seats ? `<dt>1인 좌석</dt><dd>${H.esc(v.seats)}</dd>` : ''}${v.hours ? `<dt>운영 시간</dt><dd>${H.esc(v.hours)}</dd>` : ''}</dl>` : ''}
          ${nl2p(v.note)}
          <div class="hb-foot">이 공간을 운영하는 분이 직접 적은 내용입니다. 혼플은 등급이나 순위를 매기지 않으며, 호스트 등록 여부는 혼자 지수·대화 온도에 영향을 주지 않습니다.${v.link ? ' <a>공식 채널</a>' : ''}</div>
        </div>`;
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.classList.add('hide');
      const v = Object.fromEntries(new FormData(f).entries());
      if ((v.note || '').trim().length < 20) { err.textContent = '안내 본문을 20자 이상 적어 주세요.'; err.classList.remove('hide'); return; }
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      try {
        const r = await call('/api/host/content', { method: 'POST', body: JSON.stringify(v) });
        me.host.pub = Object.assign({}, me.host.pub, r.pub);
        H.toast('저장했습니다. 공간 페이지에 1분 안에 반영됩니다');
        render('guide');
      } catch (ex) {
        err.textContent = ex.message; err.classList.remove('hide');
      }
      btn.disabled = false;
    });
  }

  /* ── 후기와 답글 ─────────────────────── */
  async function loadReviews() {
    const body = H.qs('[data-hc-body]', mainEl);
    try {
      posts = (await call('/api/host/reviews')).posts || [];
    } catch (ex) {
      body.innerHTML = `<div class="ad-err">${H.esc(ex.message)}</div>`; return;
    }
    body.innerHTML = viewReviews();
    bindReviews(body);
  }

  function viewReviews() {
    if (!posts.length) {
      return `<div class="empty"><b>아직 남겨진 후기가 없습니다</b>혼자 다녀간 손님이 공간 페이지에 글을 남기면 여기에 모입니다. 호스트 안내를 잘 써 두면 첫 손님이 더 빨리 옵니다.</div>`;
    }
    const waiting = posts.filter((p) => !(p.replies || []).some((c) => c.is_host)).length;
    return `
      <p class="small muted" style="margin:0 0 14px">${posts.length}개의 글${waiting ? ` · 답글을 기다리는 글 ${waiting}개` : ''}. 답글은 글마다 하나만 달 수 있고, 지우고 다시 쓸 수 있습니다.</p>
      <div class="hc-posts">
        ${posts.map((p) => {
          const mine = (p.replies || []).find((c) => c.is_host);
          const others = (p.replies || []).filter((c) => !c.is_host);
          return `
          <article class="hc-post" data-post="${H.esc(p.id)}">
            <div class="hc-post-h">
              <span class="tag">${PK[p.category] || H.esc(p.category)}</span>
              <b>${H.esc(p.nickname)}</b>
              <span class="muted small">${H.fmtTime(p.created_at)}</span>
              <span class="muted small hc-re">나도 ${p.metoo} · 고마워 ${p.thanks} · 가볼게 ${p.going}</span>
            </div>
            <p class="hc-post-b">${H.esc(p.body)}</p>
            ${others.length ? `<div class="hc-others">${others.map((c) => `<div class="reply"><p>${H.esc(c.body)}</p><div class="sign"><b>— ${H.esc(c.nickname)}</b> ${H.fmtTime(c.created_at)}</div></div>`).join('')}</div>` : ''}
            ${mine ? `
            <div class="reply host" data-reply="${H.esc(mine.id)}">
              <p>${H.esc(mine.body)}</p>
              <div class="sign"><b>— ${H.esc(mine.nickname)}</b> <span class="host-tag">${H.icon('i-check')}인증 호스트</span> ${H.fmtTime(mine.created_at)} <button class="linkbtn" data-del>지우기</button></div>
            </div>` : `
            <form class="reply-form" data-reply-form>
              <textarea name="body" maxlength="400" placeholder="호스트로서 답을 남깁니다. 고마움, 사실 정정, 다음에 오실 때 참고할 것 정도가 좋습니다." required></textarea>
              <div class="bar"><span>— ${H.esc(me.host.space_name)} 호스트 <span class="host-tag">${H.icon('i-check')}인증 호스트</span></span><button class="btn sm" type="submit">답글 남기기</button></div>
            </form>`}
          </article>`;
        }).join('')}
      </div>`;
  }

  function bindReviews(body) {
    body.addEventListener('submit', async (e) => {
      const f = e.target.closest('[data-reply-form]'); if (!f) return;
      e.preventDefault();
      const art = f.closest('[data-post]');
      const text = f.body.value.trim();
      if (!text) return;
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      try {
        const { comment } = await call('/api/host/reviews', { method: 'POST', body: JSON.stringify({ post_id: art.dataset.post, body: text }) });
        const p = posts.find((x) => x.id === art.dataset.post);
        if (p) { p.replies = p.replies || []; p.replies.push(comment); p.comments = (p.comments || 0) + 1; }
        me.stats.hostReplies += 1; me.stats.replies += 1;
        H.toast('답글을 남겼습니다');
        render('reviews');
      } catch (ex) { H.toast(ex.message); btn.disabled = false; }
    });
    body.addEventListener('click', async (e) => {
      const d = e.target.closest('[data-del]'); if (!d) return;
      const rep = d.closest('[data-reply]'); const art = d.closest('[data-post]');
      if (!confirm('이 답글을 지웁니다. 지운 뒤 다시 쓸 수 있습니다.')) return;
      try {
        await call('/api/host/reviews?id=' + encodeURIComponent(rep.dataset.reply), { method: 'DELETE' });
        const p = posts.find((x) => x.id === art.dataset.post);
        if (p) { p.replies = (p.replies || []).filter((c) => c.id !== rep.dataset.reply); p.comments = Math.max(0, (p.comments || 1) - 1); }
        me.stats.hostReplies = Math.max(0, me.stats.hostReplies - 1); me.stats.replies = Math.max(0, me.stats.replies - 1);
        H.toast('지웠습니다');
        render('reviews');
      } catch (ex) { H.toast(ex.message); }
    });
  }

  /* ── 잘 쓰는 법 ──────────────────────── */
  function viewHelp() {
    return `
      <div class="hc-help">
        <h2 class="sec">답글을 달 때</h2>
        <div class="hw-list">
          <div class="hw"><span class="hw-n">01</span><div><b>고맙다는 말은 짧게, 사실은 정확하게</b>혼자 와 준 손님에게 긴 인사는 부담입니다. “와 주셔서 고맙습니다. 말씀하신 창가 자리는 평일 6시 전이 비어 있습니다” 정도면 충분합니다.</div></div>
          <div class="hw"><span class="hw-n">02</span><div><b>불편했다는 글에는 변명보다 바뀐 점을</b>“그날은 사정이 있었다”보다 “카운터 조명을 바꿨다”가 다음 손님을 데려옵니다. 바꿀 수 없는 것이면 그렇다고 적어 주세요. 손님은 솔직함을 알아봅니다.</div></div>
          <div class="hw"><span class="hw-n">03</span><div><b>논쟁은 하지 않습니다</b>후기는 익명이고, 손님은 답할 수 없는 자리에 있습니다. 반박이 꼭 필요하면 사실만 한 줄 적고 끝내 주세요. 글이 도를 넘었다고 느끼시면 답글 대신 운영자에게 신고해 주세요.</div></div>
          <div class="hw"><span class="hw-n">04</span><div><b>연락처와 링크는 넣을 수 없습니다</b>답글과 안내 본문에서 전화번호·메신저 아이디·주소(URL)는 자동으로 막힙니다. 공식 채널은 호스트 안내의 ‘공식 채널’ 칸에만 넣어 주세요.</div></div>
        </div>

        <h2 class="sec">호스트 안내는 언제 고치나요</h2>
        <div class="hw-list">
          <div class="hw"><span class="hw-n">01</span><div><b>운영 시간이나 휴무가 바뀌었을 때</b>혼자 오는 손님은 헛걸음에 특히 약합니다. 임시 휴무도 안내 첫 줄에 적어 두면 좋습니다.</div></div>
          <div class="hw"><span class="hw-n">02</span><div><b>좌석 배치가 바뀌었을 때</b>1인석이 늘거나 줄었다면 바로 고쳐 주세요. 혼플에서 손님이 가장 먼저 보는 정보입니다.</div></div>
          <div class="hw"><span class="hw-n">03</span><div><b>계절 메뉴나 혼자 먹기 좋은 메뉴가 생겼을 때</b>“1인 세트” “반 병 판매” 같은 정보는 홍보가 아니라 안내입니다. 얼마든지 적으셔도 됩니다.</div></div>
        </div>

        <h2 class="sec">자주 묻는 것</h2>
        <div class="faq">
          <details><summary>안내를 저장했는데 공간 페이지에 안 보입니다</summary><p>저장 뒤 1분 안에 반영됩니다. 브라우저가 이전 화면을 기억하고 있을 수 있으니 새로고침해 보세요. 그래도 안 보이면 아직 공간 페이지가 만들어지지 않은 경우입니다. 운영자가 등록을 마치면 연결됩니다.</p></details>
          <details><summary>가게 이름·주소·분류를 바꾸고 싶습니다</summary><p>이 정보는 검색엔진에 고정으로 실리는 부분이라 호스트센터에서 직접 바꿀 수 없습니다. <a href="mailto:${H.esc(root.dataset.bizEmail || '')}">문의 메일</a>로 알려 주시면 고쳐 드립니다.</p></details>
          <details><summary>혼자 지수나 대화 온도를 바꿀 수 있나요</summary><p>없습니다. 그 둘은 손님 쪽에서 본 표시라 호스트가 정하지 않습니다. 다만 “사실과 다르다”고 생각되면 문의해 주세요. 공개 자료와 후기를 다시 보고 판단합니다.</p></details>
          <details><summary>후기를 지워 달라고 할 수 있나요</summary><p>사실과 다른 비방, 욕설, 개인정보가 담긴 글은 신고해 주시면 운영자가 확인하고 숨깁니다. 단순히 좋지 않은 평가라는 이유로는 지우지 않습니다. 대신 답글로 바뀐 점을 알려 주세요.</p></details>
          <details><summary>키가 다른 사람에게 알려진 것 같습니다</summary><p>바로 문의 메일로 알려 주세요. 새 키를 발급하고 이전 키는 즉시 막습니다. 평소에는 공용 컴퓨터에서 ‘나가기’를 눌러 키를 지워 두세요.</p></details>
          <details><summary>호스트를 그만두고 싶습니다</summary><p>문의 메일로 알려 주시면 호스트 안내와 답글, 수집한 연락처를 지웁니다. 공간 페이지 자체는 공개 정보라 남지만 ‘호스트 확인’ 표시는 사라집니다.</p></details>
        </div>
      </div>`;
  }

  /* ── 시작 ────────────────────────────── */
  if (key) {
    form.key.value = key;
    try { await enter(); }
    catch (err) {
      if (err.status === 401) { try { localStorage.removeItem(KEY); } catch { /* */ } key = ''; form.key.value = ''; showErr('저장된 키가 더 이상 맞지 않습니다. 다시 입력해 주세요.'); }
      else if (err.status === 503) showErr('데이터베이스가 아직 연결되어 있지 않습니다.');
      else showErr(err.message || '들어갈 수 없습니다');
    }
  } else {
    const k = H.param('key');
    if (k) form.key.value = k;
  }
})();
