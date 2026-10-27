/* 혼플 admin.js — 운영 관리 화면
   접속 키는 이 기기에만 저장되고 서버로는 요청할 때만 전달됩니다. */
(function () {
  const root = H.qs('[data-admin]');
  const KEY = 'hp_admin_key';
  let key = localStorage.getItem(KEY) || H.param('key') || '';
  let tab = location.hash.replace('#', '') || 'home';
  let cache = {};

  const api = async (qs, opt) => {
    const r = await fetch('/api/admin?key=' + encodeURIComponent(key) + (qs ? '&' + qs : ''), opt);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || '요청에 실패했습니다');
    return j;
  };
  const post = (body) => api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const CAT = { today: '오늘 한마디', story: '그냥 이야기', review: '다녀왔어요', ask: '어디 갈까요' };
  const fmt = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const cut = (s, n) => (s || '').length > n ? s.slice(0, n) + '…' : (s || '');

  /* ── 로그인 ───────────────────────────── */
  function login(msg) {
    root.innerHTML = `
      <div class="ad-login">
        <h1>혼플 관리자</h1>
        <p class="muted small">Cloudflare Pages 환경변수에 설정한 ADMIN_KEY 를 입력하세요. 키는 이 브라우저에만 저장됩니다.</p>
        ${msg ? `<p class="ad-err">${H.esc(msg)}</p>` : ''}
        <form data-login>
          <input type="password" name="key" placeholder="ADMIN_KEY" autocomplete="current-password" required>
          <button class="btn lamp" type="submit">들어가기</button>
        </form>
      </div>`;
    H.qs('[data-login]').addEventListener('submit', async (e) => {
      e.preventDefault();
      key = new FormData(e.target).get('key').trim();
      try { await api('what=stats'); localStorage.setItem(KEY, key); start(); }
      catch (err) { login(err.message); }
    });
  }

  /* ── 뼈대 ─────────────────────────────── */
  const TABS = [
    ['home', '대시보드'],
    ['posts', '글 관리'],
    ['reported', '신고'],
    ['subs', '제보'],
    ['hosts', '호스트'],
    ['places', '플레이스'],
    ['help', '도움말']
  ];
  function frame(inner, badge = {}) {
    root.innerHTML = `
      <div class="ad-top">
        <h1>혼플 관리자</h1>
        <div class="ad-top-r">
          <a class="btn ghost sm" href="/" target="_blank" rel="noopener">사이트 열기</a>
          <button class="btn ghost sm" data-logout>키 지우기</button>
        </div>
      </div>
      <nav class="ad-tabs">
        ${TABS.map(([id, label]) => `<button class="chip${tab === id ? ' on' : ''}" data-tab="${id}">${label}${badge[id] ? `<span class="ad-badge">${badge[id]}</span>` : ''}</button>`).join('')}
      </nav>
      <div class="ad-body" data-body>${inner}</div>`;
    H.qs('[data-logout]').onclick = () => { localStorage.removeItem(KEY); key = ''; login(); };
    H.qsa('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; location.hash = tab; render(); });
  }
  const setBody = (html) => { const b = H.qs('[data-body]'); if (b) b.innerHTML = html; };

  /* ── 대시보드 ─────────────────────────── */
  async function viewHome() {
    const d = await api('what=stats');
    cache.stats = d;
    const s = d.stats;
    const max = Math.max(1, ...d.daily.map((x) => x.n));
    const tile = (label, v, note = '') => `<div class="ad-tile"><small>${label}</small><b>${v}</b>${note ? `<span>${note}</span>` : ''}</div>`;
    return `
      <div class="ad-tiles">
        ${tile('전체 글', s.posts, `보이는 글 ${s.visible} · 숨김 ${s.hidden}`)}
        ${tile('오늘 올라온 글', s.today, `최근 7일 ${s.week}`)}
        ${tile('신고 대기', s.reported, s.reported ? '확인이 필요합니다' : '없음')}
        ${tile('제보 대기', s.subsNew, `전체 제보 ${s.subsAll}`)}
        ${tile('답글', s.comments)}
        ${tile('호스트 신청 대기', s.hostsNew ?? 0, `인증 완료 ${s.hostsVerified ?? 0}곳`)}
        ${tile('등록 플레이스', cache.places ? cache.places.length : '—', '플레이스 탭에서 확인')}
      </div>

      <h2 class="ad-h">최근 2주 글 추이</h2>
      <div class="ad-chart">
        ${d.daily.length ? d.daily.map((x) => `<div class="ad-bar" title="${x.d} — ${x.n}건"><i style="height:${Math.round(x.n / max * 100)}%"></i><small>${x.d.slice(5).replace('-', '/')}</small></div>`).join('') : '<p class="muted small">아직 데이터가 없습니다.</p>'}
      </div>

      <div class="ad-two">
        <div>
          <h2 class="ad-h">분류별 글</h2>
          ${d.byCat.length ? `<table class="ad-table"><tbody>${d.byCat.map((c) => `<tr><td>${CAT[c.category] || c.category}</td><td class="r">${c.n}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">없음</p>'}
        </div>
        <div>
          <h2 class="ad-h">후기가 많은 플레이스</h2>
          ${d.topSpaces.length ? `<table class="ad-table"><tbody>${d.topSpaces.map((x) => `<tr><td><a href="/place/${encodeURIComponent(x.space_id)}" target="_blank" rel="noopener">${H.esc(x.space_name || x.space_id)}</a></td><td class="r">${x.n}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">아직 후기가 없습니다.</p>'}
        </div>
      </div>`;
  }

  /* ── 글 관리 ──────────────────────────── */
  const pq = { q: '', category: '', state: '', offset: 0, limit: 30 };
  async function viewPosts(reported) {
    if (reported) { pq.state = 'reported'; pq.offset = 0; }
    const d = await api('what=posts&' + new URLSearchParams(pq));
    const rows = d.posts.map((p) => `
      <tr data-id="${H.esc(p.id)}" class="${p.hidden ? 'is-hidden' : ''}">
        <td><input type="checkbox" data-pick aria-label="선택"></td>
        <td class="ad-when">${fmt(p.created_at)}</td>
        <td><span class="tag">${CAT[p.category] || p.category}</span></td>
        <td class="ad-bodycell">
          <div class="ad-text">${H.esc(cut(p.body, 160))}</div>
          <div class="ad-sub">— ${H.esc(p.nickname)}${p.space_name ? ` · <a href="/place/${encodeURIComponent(p.space_id)}" target="_blank" rel="noopener">${H.esc(p.space_name)}</a>` : ''}
            · 반응 ${p.metoo + p.thanks + p.going} · 답글 ${p.comments}${p.reports ? ` · <b class="ad-warn">신고 ${p.reports}</b>` : ''}${p.hidden ? ' · <b>숨김</b>' : ''}</div>
        </td>
        <td class="ad-act">
          ${p.hidden
            ? `<button class="btn ghost sm" data-act="unhide">복구</button>`
            : `<button class="btn ghost sm" data-act="hide">숨기기</button>`}
          <button class="btn ghost sm" data-act="replies">답글</button>
          <button class="btn ghost sm danger" data-act="delete">삭제</button>
        </td>
      </tr>`).join('');

    const pages = Math.ceil(d.total / pq.limit) || 1;
    const cur = Math.floor(pq.offset / pq.limit) + 1;
    return `
      <div class="ad-filters">
        <input type="search" data-q value="${H.esc(pq.q)}" placeholder="글 내용, 이름, 플레이스로 찾기">
        <select data-state>
          <option value=""${pq.state === '' ? ' selected' : ''}>전체</option>
          <option value="visible"${pq.state === 'visible' ? ' selected' : ''}>보이는 글</option>
          <option value="hidden"${pq.state === 'hidden' ? ' selected' : ''}>숨긴 글</option>
          <option value="reported"${pq.state === 'reported' ? ' selected' : ''}>신고된 글</option>
        </select>
        <select data-cat>
          <option value="">분류 전체</option>
          ${Object.entries(CAT).map(([k, v]) => `<option value="${k}"${pq.category === k ? ' selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="ad-bulk">
        <label><input type="checkbox" data-pick-all> 전체 선택</label>
        <button class="btn ghost sm" data-bulk="hide">선택 숨기기</button>
        <button class="btn ghost sm" data-bulk="unhide">선택 복구</button>
        <button class="btn ghost sm danger" data-bulk="delete">선택 삭제</button>
        <span class="muted small">${d.total}건 중 ${d.posts.length}건</span>
      </div>
      <table class="ad-table posts"><tbody>${rows || '<tr><td class="muted" style="padding:24px 0">조건에 맞는 글이 없습니다.</td></tr>'}</tbody></table>
      ${pages > 1 ? `<div class="ad-page"><button class="btn ghost sm" data-page="prev"${cur === 1 ? ' disabled' : ''}>이전</button><span>${cur} / ${pages}</span><button class="btn ghost sm" data-page="next"${cur === pages ? ' disabled' : ''}>다음</button></div>` : ''}`;
  }

  function bindPosts() {
    const body = H.qs('[data-body]');
    const q = H.qs('[data-q]', body);
    if (q) { let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { pq.q = q.value.trim(); pq.offset = 0; render(); }, 250); }; }
    const st = H.qs('[data-state]', body); if (st) st.onchange = () => { pq.state = st.value; pq.offset = 0; render(); };
    const ct = H.qs('[data-cat]', body); if (ct) ct.onchange = () => { pq.category = ct.value; pq.offset = 0; render(); };
    const all = H.qs('[data-pick-all]', body);
    if (all) all.onchange = () => H.qsa('[data-pick]', body).forEach((c) => (c.checked = all.checked));
    H.qsa('[data-page]', body).forEach((b) => b.onclick = () => {
      pq.offset = Math.max(0, pq.offset + (b.dataset.page === 'next' ? pq.limit : -pq.limit));
      render();
    });
    H.qsa('[data-bulk]', body).forEach((b) => b.onclick = async () => {
      const ids = H.qsa('tr[data-id]', body).filter((tr) => H.qs('[data-pick]', tr)?.checked).map((tr) => tr.dataset.id);
      if (!ids.length) return H.toast('선택된 글이 없습니다');
      if (b.dataset.bulk === 'delete' && !confirm(`${ids.length}건을 영구 삭제합니다. 되돌릴 수 없습니다.`)) return;
      await post({ action: 'bulk', ids, op: b.dataset.bulk });
      H.toast(`${ids.length}건 처리했습니다`); render();
    });
    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const tr = btn.closest('tr'); const id = tr.dataset.id; const act = btn.dataset.act;
      if (act === 'replies') {
        const open = tr.nextElementSibling?.classList.contains('ad-replies');
        if (open) { tr.nextElementSibling.remove(); return; }
        const { comments } = await api('what=comments&post=' + encodeURIComponent(id));
        const html = comments.length
          ? comments.map((c) => `<div class="ad-reply"><p>${H.esc(c.body)}</p><div class="ad-sub">— ${H.esc(c.nickname)} · ${fmt(c.created_at)} <button class="btn ghost sm danger" data-del-reply="${H.esc(c.id)}">삭제</button></div></div>`).join('')
          : '<p class="muted small">답글이 없습니다.</p>';
        tr.insertAdjacentHTML('afterend', `<tr class="ad-replies"><td colspan="5">${html}</td></tr>`);
        return;
      }
      if (act === 'delete' && !confirm('이 글과 답글을 영구 삭제합니다. 되돌릴 수 없습니다.')) return;
      await post({ action: act, id });
      H.toast(act === 'delete' ? '삭제했습니다' : act === 'hide' ? '숨겼습니다' : '복구했습니다');
      render();
    });
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-del-reply]'); if (!b) return;
      if (!confirm('이 답글을 삭제합니다.')) return;
      await post({ action: 'comment-delete', id: b.dataset.delReply });
      H.toast('답글을 삭제했습니다'); render();
    });
  }

  /* ── 제보 ─────────────────────────────── */
  let subStatus = 'new';
  async function viewSubs() {
    const { submissions } = await api('what=submissions&status=' + subStatus);
    const TALK = ['조용히 있어도 됨', '원하면 한마디', '이야기가 중심'];
    const cards = submissions.map((s) => `
      <article class="ad-card" data-sub="${H.esc(s.id)}">
        <div class="ad-card-h">
          <b>${H.esc(s.name)}</b>
          ${s.fix_id ? `<span class="tag">수정 제안 · ${H.esc(s.fix_id)}</span>` : '<span class="tag kind">신규</span>'}
          <span class="muted small">${fmt(s.created_at)}</span>
          <span class="ad-status s-${H.esc(s.status || 'new')}">${s.status === 'done' ? '처리됨' : s.status === 'skip' ? '보류' : '대기'}</span>
        </div>
        <dl class="ad-dl">
          ${s.area ? `<dt>동네</dt><dd>${H.esc(s.area)}</dd>` : ''}
          ${s.cat ? `<dt>종류</dt><dd>${H.esc(s.cat)}</dd>` : ''}
          ${s.solo != null ? `<dt>혼자 지수</dt><dd>${s.solo} / 5</dd>` : ''}
          ${s.talk != null ? `<dt>대화 온도</dt><dd>${TALK[s.talk] || s.talk}</dd>` : ''}
          ${s.time ? `<dt>시간</dt><dd>${H.esc(s.time)}</dd>` : ''}
        </dl>
        <p class="ad-note">${H.esc(s.note)}</p>
        <div class="ad-card-f">
          <a class="btn ghost sm" href="https://map.naver.com/p/search/${encodeURIComponent((s.name || '') + ' ' + (s.area || ''))}" target="_blank" rel="noopener">지도에서 확인</a>
          <button class="btn ghost sm" data-json>spaces.json 조각 복사</button>
          <span class="sp"></span>
          <button class="btn ghost sm" data-st="done">처리 완료</button>
          <button class="btn ghost sm" data-st="skip">보류</button>
          ${s.status !== 'new' ? '<button class="btn ghost sm" data-st="new">대기로</button>' : ''}
        </div>
      </article>`).join('');

    return `
      <div class="ad-filters">
        <div class="chips">
          ${[['new', '대기'], ['done', '처리됨'], ['skip', '보류'], ['all', '전체']].map(([v, l]) =>
            `<button class="chip${subStatus === v ? ' on' : ''}" data-substatus="${v}">${l}</button>`).join('')}
        </div>
      </div>
      <p class="muted small" style="margin:0 0 16px">‘spaces.json 조각 복사’를 누르면 아래 플레이스 탭에서 붙여 넣을 수 있는 형식으로 클립보드에 복사됩니다.</p>
      ${cards || '<p class="muted" style="padding:24px 0">해당하는 제보가 없습니다.</p>'}`;
  }

  function bindSubs() {
    const body = H.qs('[data-body]');
    H.qsa('[data-substatus]', body).forEach((b) => b.onclick = () => { subStatus = b.dataset.substatus; render(); });
    body.addEventListener('click', async (e) => {
      const card = e.target.closest('[data-sub]'); if (!card) return;
      const id = card.dataset.sub;
      const st = e.target.closest('[data-st]');
      if (st) { await post({ action: 'submission', id, status: st.dataset.st }); H.toast('상태를 바꿨습니다'); render(); return; }
      if (e.target.closest('[data-json]')) {
        const name = H.qs('.ad-card-h b', card).textContent;
        const dd = H.qsa('.ad-dl dd', card).map((x) => x.textContent);
        const dt = H.qsa('.ad-dl dt', card).map((x) => x.textContent);
        const get = (k) => dd[dt.indexOf(k)] || '';
        const slug = 'new-' + Date.now().toString(36);
        const obj = {
          id: slug, kind: 'place', name,
          cat: get('종류') || 'honsul',
          area: get('동네') || '',
          addr: '',
          solo: parseInt(get('혼자 지수')) || 4,
          talk: ['조용히 있어도 됨', '원하면 한마디', '이야기가 중심'].indexOf(get('대화 온도')),
          price: '1~2만 원', tier: 1,
          time: ['evening'],
          tags: [],
          intro: '', culture: '', first: '',
          notes: [H.qs('.ad-note', card).textContent.slice(0, 120)],
          mapq: `${name} ${get('동네')}`.trim()
        };
        if (obj.talk < 0) obj.talk = 0;
        navigator.clipboard.writeText(JSON.stringify(obj, null, 2))
          .then(() => H.toast('복사했습니다. 플레이스 탭에서 붙여 넣으세요'))
          .catch(() => H.toast('복사에 실패했습니다'));
      }
    });
  }

  /* ── 호스트 ───────────────────────────── */
  let hostStatus = 'pending';
  const HST = { new: '접수', reviewing: '확인 중', verified: '인증 완료', rejected: '반려' };
  async function viewHosts() {
    const { hosts } = await api('what=hosts&status=' + hostStatus);
    const CATL = { honsul: '혼술', honbap: '혼밥', cafe: '카페·서점', culture: '영화·전시·공연', move: '몸 쓰기', rest: '쉬기', learn: '배우기', social: '가벼운 모임' };
    const biz = (n) => (n || '').replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3');
    const cards = hosts.map((h) => `
      <article class="ad-card" data-host="${H.esc(h.id)}">
        <div class="ad-card-h">
          <b>${H.esc(h.space_name)}</b>
          ${h.cat ? `<span class="tag">${CATL[h.cat] || h.cat}</span>` : ''}
          ${h.space_id ? `<a class="tag kind" href="/place/${encodeURIComponent(h.space_id)}" target="_blank" rel="noopener">등록된 플레이스</a>` : '<span class="tag">신규</span>'}
          <span class="muted small">${fmt(h.created_at)}</span>
          <span class="ad-status s-${h.status === 'verified' ? 'ok' : h.status === 'rejected' ? 'no' : 'new'}">${HST[h.status] || h.status}</span>
        </div>
        <dl class="ad-dl">
          <dt>담당자</dt><dd>${H.esc(h.owner_name)}</dd>
          <dt>이메일</dt><dd><a href="mailto:${H.esc(h.email)}">${H.esc(h.email)}</a></dd>
          ${h.phone ? `<dt>연락처</dt><dd>${H.esc(h.phone)}</dd>` : ''}
          <dt>사업자번호</dt><dd>${H.esc(biz(h.biz_no))}</dd>
          ${h.area ? `<dt>동네</dt><dd>${H.esc(h.area)}</dd>` : ''}
          ${h.addr ? `<dt>주소</dt><dd>${H.esc(h.addr)}</dd>` : ''}
          ${h.solo_seats ? `<dt>1인 좌석</dt><dd>${H.esc(h.solo_seats)}</dd>` : ''}
          ${h.link ? `<dt>채널</dt><dd><a href="${H.esc(h.link)}" target="_blank" rel="noopener nofollow">${H.esc(h.link)}</a></dd>` : ''}
        </dl>
        <p class="ad-note"><b>혼자 오는 손님 안내</b>${H.esc(h.solo_note)}</p>
        ${h.message ? `<p class="ad-note muted"><b>하고 싶은 말</b>${H.esc(h.message)}</p>` : ''}
        ${h.admin_memo ? `<p class="ad-memo">메모: ${H.esc(h.admin_memo)}</p>` : ''}
        <div class="ad-card-f">
          <a class="btn ghost sm" href="https://map.naver.com/p/search/${encodeURIComponent((h.space_name || '') + ' ' + (h.area || ''))}" target="_blank" rel="noopener">지도 확인</a>
          <a class="btn ghost sm" href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${H.esc((h.biz_no || '').replace(/\D/g, ''))}" target="_blank" rel="noopener">사업자 조회</a>
          <button class="btn ghost sm" data-host-json>spaces.json 조각 복사</button>
          <span class="sp"></span>
          ${h.status !== 'reviewing' ? '<button class="btn ghost sm" data-hs="reviewing">확인 중</button>' : ''}
          ${h.status !== 'verified' ? '<button class="btn lamp sm" data-hs="verified">인증 승인</button>' : ''}
          ${h.status !== 'rejected' ? '<button class="btn ghost sm danger" data-hs="rejected">반려</button>' : ''}
        </div>
      </article>`).join('');

    return `
      <div class="ad-filters">
        <div class="chips">
          ${[['pending', '대기'], ['verified', '인증 완료'], ['rejected', '반려'], ['all', '전체']].map(([v, l]) =>
            `<button class="chip${hostStatus === v ? ' on' : ''}" data-hoststatus="${v}">${l}</button>`).join('')}
        </div>
      </div>
      <p class="muted small" style="margin:0 0 16px">승인하기 전에 지도와 사업자 조회로 실재하는 공간인지 확인하세요. 승인한 뒤에는 ‘spaces.json 조각 복사’로 받은 내용을 플레이스 탭에 붙여 넣고 빌드해야 공간 페이지에 호스트 안내가 나옵니다.</p>
      ${cards || '<p class="muted" style="padding:24px 0">해당하는 신청이 없습니다.</p>'}`;
  }

  function bindHosts() {
    const body = H.qs('[data-body]');
    H.qsa('[data-hoststatus]', body).forEach((b) => b.onclick = () => { hostStatus = b.dataset.hoststatus; render(); });
    body.addEventListener('click', async (e) => {
      const card = e.target.closest('[data-host]'); if (!card) return;
      const id = card.dataset.host;

      const st = e.target.closest('[data-hs]');
      if (st) {
        const to = st.dataset.hs;
        if (to === 'verified' && !confirm('이 공간을 인증 호스트로 승인합니다. 실재하는 공간인지 확인하셨나요?')) return;
        const memo = to === 'rejected' ? (prompt('반려 사유를 적어 두세요(선택). 신청자에게 자동 발송되지는 않습니다.') || '') : '';
        await post({ action: 'host', id, status: to, memo });
        H.toast(to === 'verified' ? '인증 승인했습니다' : to === 'rejected' ? '반려했습니다' : '확인 중으로 바꿨습니다');
        render();
        return;
      }

      if (e.target.closest('[data-host-json]')) {
        const get = (k) => {
          const dt = H.qsa('.ad-dl dt', card).map((x) => x.textContent);
          const dd = H.qsa('.ad-dl dd', card).map((x) => x.textContent.trim());
          return dd[dt.indexOf(k)] || '';
        };
        const name = H.qs('.ad-card-h b', card).textContent;
        const note = (H.qs('.ad-note', card)?.textContent || '').replace(/^혼자 오는 손님 안내\s*/, '').trim();
        const today = new Date().toISOString().slice(0, 10);
        const frag = {
          host: {
            verified: today,
            title: '운영자가 직접 쓴 안내',
            seats: get('1인 좌석'),
            hours: '',
            note,
            link: get('채널')
          }
        };
        navigator.clipboard.writeText(
          `// ${name} 의 spaces.json 항목 안에 아래 "host" 를 넣으세요\n` + JSON.stringify(frag, null, 2).replace(/^\{\n|\n\}$/g, '')
        ).then(() => H.toast('복사했습니다. 플레이스 탭에서 해당 항목에 붙여 넣으세요'))
         .catch(() => H.toast('복사에 실패했습니다'));
      }
    });
  }

  /* ── 플레이스 ─────────────────────────── */
  async function viewPlaces() {
    if (!cache.places) {
      const j = await (await fetch('/data/spaces.json', { cache: 'no-cache' })).json();
      cache.places = j.spaces; cache.cats = j.categories;
    }
    const list = cache.places, cats = cache.cats;
    const byCat = cats.map((c) => ({ c, n: list.filter((s) => s.cat === c.id).length }));
    const noAddr = list.filter((s) => s.kind === 'place' && !s.addr);
    const rows = list.map((s) => `
      <tr>
        <td class="ad-when">${H.esc(s.id)}</td>
        <td><a href="/place/${encodeURIComponent(s.id)}" target="_blank" rel="noopener">${H.esc(s.name)}</a>${s.kind === 'type' ? ' <span class="tag kind">유형</span>' : ''}</td>
        <td>${H.esc(cats.find((c) => c.id === s.cat)?.label || s.cat)}</td>
        <td>${H.esc(s.area)}</td>
        <td class="r">${s.solo}</td>
        <td><a href="https://map.naver.com/p/search/${encodeURIComponent(s.mapq || s.name)}" target="_blank" rel="noopener">N</a> · <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.mapq || s.name)}" target="_blank" rel="noopener">G</a></td>
      </tr>`).join('');

    return `
      <div class="ad-tiles">
        <div class="ad-tile"><small>등록 플레이스</small><b>${list.length}</b><span>실제 장소 ${list.filter((s) => s.kind === 'place').length} · 유형 ${list.filter((s) => s.kind === 'type').length}</span></div>
        <div class="ad-tile"><small>주소 미입력</small><b>${noAddr.length}</b><span>${noAddr.length ? '채워 두면 검색에 도움이 됩니다' : '모두 입력됨'}</span></div>
        <div class="ad-tile"><small>분류</small><b>${cats.length}</b><span>${byCat.map((x) => `${x.c.label} ${x.n}`).join(' · ')}</span></div>
      </div>

      <h2 class="ad-h">플레이스를 추가하거나 고치려면</h2>
      <ol class="ad-steps">
        <li>아래 편집기에서 내용을 고칩니다. 새 항목은 목록 끝에 추가하면 됩니다.</li>
        <li><b>검사</b>를 눌러 형식 오류가 없는지 확인합니다.</li>
        <li><b>파일 내려받기</b>를 눌러 <code>spaces.json</code> 을 받습니다.</li>
        <li>깃허브 저장소의 <code>data/spaces.json</code> 에 같은 이름으로 덮어쓰고 커밋하면 1~2분 뒤 사이트에 반영됩니다.</li>
      </ol>
      <p class="muted small">사이트의 각 페이지는 저장소에서 다시 빌드할 때 만들어집니다. 새 플레이스의 전용 페이지(/place/…)까지 만들려면 저장소에서 <code>node tools/build.mjs</code> 를 한 번 실행해야 합니다. 그 과정이 번거로우면 제보 내용을 그대로 두고 알려 주세요.</p>

      <div class="ad-editor">
        <div class="ad-editor-bar">
          <button class="btn ghost sm" data-validate>검사</button>
          <button class="btn ghost sm" data-format>보기 좋게 정리</button>
          <button class="btn lamp sm" data-download>파일 내려받기</button>
          <span class="ad-valid" data-valid></span>
        </div>
        <textarea data-json-editor spellcheck="false"></textarea>
      </div>

      <h2 class="ad-h">등록된 플레이스</h2>
      <table class="ad-table"><thead><tr><th>id</th><th>이름</th><th>분류</th><th>지역</th><th class="r">혼자</th><th>지도</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function bindPlaces() {
    const body = H.qs('[data-body]');
    const ta = H.qs('[data-json-editor]', body);
    const valid = H.qs('[data-valid]', body);
    if (!ta) return;
    fetch('/data/spaces.json', { cache: 'no-cache' }).then((r) => r.text()).then((t) => { ta.value = t; });

    const check = () => {
      try {
        const j = JSON.parse(ta.value);
        if (!Array.isArray(j.spaces)) throw new Error('spaces 배열이 없습니다');
        const ids = j.spaces.map((s) => s.id);
        const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
        if (dup.length) throw new Error('중복된 id: ' + [...new Set(dup)].join(', '));
        const need = ['id', 'name', 'cat', 'area', 'solo', 'talk', 'price', 'time', 'intro'];
        for (const s of j.spaces) {
          const miss = need.filter((k) => s[k] === undefined);
          if (miss.length) throw new Error(`${s.id || '이름 없음'} — 빠진 항목: ${miss.join(', ')}`);
        }
        valid.textContent = `이상 없음 · ${j.spaces.length}곳`;
        valid.className = 'ad-valid ok';
        return j;
      } catch (e) {
        valid.textContent = e.message;
        valid.className = 'ad-valid err';
        return null;
      }
    };
    H.qs('[data-validate]', body).onclick = check;
    H.qs('[data-format]', body).onclick = () => { const j = check(); if (j) ta.value = JSON.stringify(j, null, 2); };
    H.qs('[data-download]', body).onclick = () => {
      const j = check(); if (!j) return H.toast('형식 오류를 먼저 고쳐 주세요');
      const blob = new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'spaces.json'; a.click();
      URL.revokeObjectURL(a.href);
      H.toast('내려받았습니다. 깃허브 data/spaces.json 에 덮어쓰세요');
    };
  }

  /* ── 도움말 ───────────────────────────── */
  function viewHelp() {
    return `
      <h2 class="ad-h">이 화면에서 할 수 있는 것</h2>
      <table class="ad-table"><tbody>
        <tr><td><b>대시보드</b></td><td>글 수, 오늘 올라온 글, 신고·제보 대기 건수, 최근 2주 추이</td></tr>
        <tr><td><b>글 관리</b></td><td>전체 글 검색·필터, 숨기기·복구·삭제, 답글 확인과 삭제, 여러 건 한 번에 처리</td></tr>
        <tr><td><b>신고</b></td><td>신고가 쌓인 글만 모아 보기. 신고 3건이면 자동으로 숨겨집니다</td></tr>
        <tr><td><b>제보</b></td><td>방문자가 보낸 플레이스 제보와 정보 수정 제안. 처리 상태를 바꾸고 등록용 JSON 조각을 복사할 수 있습니다</td></tr>
        <tr><td><b>호스트</b></td><td>공간 운영자의 등록 신청 심사. 지도·사업자 조회로 실재 확인 후 승인·반려</td></tr>
        <tr><td><b>플레이스</b></td><td>등록 현황 확인과 spaces.json 편집·내려받기</td></tr>
      </tbody></table>

      <h2 class="ad-h">운영에서 자주 하는 일</h2>
      <ol class="ad-steps">
        <li><b>매일</b> — 대시보드에서 신고 대기 숫자만 확인합니다. 0이면 할 일이 없습니다.</li>
        <li><b>신고가 있으면</b> — 신고 탭에서 내용을 읽고 숨기기 또는 복구를 누릅니다. 명백한 광고·비방은 삭제합니다.</li>
        <li><b>제보가 쌓이면</b> — 제보 탭에서 지도로 실재를 확인하고, 쓸 만하면 JSON 조각을 복사해 플레이스 탭에서 붙여 넣습니다.</li>
        <li><b>호스트 신청이 오면</b> — 호스트 탭에서 지도와 사업자 조회로 실재하는 공간인지 확인하고, 맞으면 인증 승인합니다. 그다음 ‘spaces.json 조각 복사’로 받은 host 블록을 플레이스 탭의 해당 항목에 붙여 넣고 빌드하면 공간 페이지에 호스트 안내가 나옵니다.</li>
        <li><b>플레이스를 늘리면</b> — spaces.json 을 내려받아 깃허브에 덮어쓰고, 저장소에서 빌드를 한 번 돌립니다.</li>
      </ol>

      <h2 class="ad-h">주의</h2>
      <ul class="ad-ul">
        <li>삭제는 되돌릴 수 없습니다. 애매하면 숨기기를 쓰세요.</li>
        <li>익명 게시판이라 작성자를 특정할 수 없습니다. IP는 복원 불가능한 해시로만 저장됩니다.</li>
        <li>관리자 키는 이 브라우저에만 저장됩니다. 공용 PC에서는 나갈 때 ‘키 지우기’를 누르세요.</li>
        <li>이 주소는 검색에 노출되지 않도록 설정되어 있지만, 주소 자체가 비밀은 아닙니다. 키를 길게 만드세요.</li>
        <li>호스트 신청에는 담당자 이름·연락처·사업자등록번호 같은 개인정보가 들어 있습니다. 화면을 공유하거나 캡처할 때 주의하고, 처리가 끝난 신청은 주기적으로 정리하세요.</li>
      </ul>`;
  }

  /* ── 렌더 ─────────────────────────────── */
  async function render() {
    const badge = {};
    if (cache.stats) {
      if (cache.stats.stats.reported) badge.reported = cache.stats.stats.reported;
      if (cache.stats.stats.subsNew) badge.subs = cache.stats.stats.subsNew;
      if (cache.stats.stats.hostsNew) badge.hosts = cache.stats.stats.hostsNew;
    }
    frame('<div class="sk">불러오는 중</div>', badge);
    try {
      if (tab === 'home') setBody(await viewHome());
      else if (tab === 'posts') { setBody(await viewPosts(false)); bindPosts(); }
      else if (tab === 'reported') { setBody(await viewPosts(true)); bindPosts(); }
      else if (tab === 'subs') { setBody(await viewSubs()); bindSubs(); }
      else if (tab === 'hosts') { setBody(await viewHosts()); bindHosts(); }
      else if (tab === 'places') { setBody(await viewPlaces()); bindPlaces(); }
      else setBody(viewHelp());
    } catch (e) {
      if (/권한/.test(e.message)) return login('키가 맞지 않습니다');
      setBody(`<div class="ad-err">${H.esc(e.message)}</div><p class="muted small">데이터베이스(D1)가 연결되어 있는지 확인해 주세요. <a href="/api/health" target="_blank" rel="noopener">/api/health</a> 에서 ready 값을 볼 수 있습니다.</p>`);
    }
  }

  async function start() {
    try { cache.stats = await api('what=stats'); } catch (e) {
      if (/권한/.test(e.message)) return login(key ? '키가 맞지 않습니다' : '');
    }
    render();
  }

  window.addEventListener('hashchange', () => { const t = location.hash.replace('#', ''); if (t && t !== tab) { tab = t; render(); } });
  if (!key) login(); else start();
})();
