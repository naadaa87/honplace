/* 혼플 host.js — 호스트 등록 신청 폼 */
(async function () {
  const form = H.qs('[data-host-form]');
  if (!form) return;

  const done = H.qs('[data-host-done]');
  const errEl = H.qs('[data-err]');
  const matchEl = H.qs('[data-match]');
  const nameInput = form.querySelector('[name=space_name]');
  const idInput = form.querySelector('[name=space_id]');
  const bizInput = form.querySelector('[name=biz_no]');

  /* ── 사업자등록번호 입력 보조 ── */
  bizInput.addEventListener('input', () => {
    const n = bizInput.value.replace(/\D/g, '').slice(0, 10);
    bizInput.value = n.length > 5 ? `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`
      : n.length > 3 ? `${n.slice(0, 3)}-${n.slice(3)}` : n;
  });

  /* ── 이미 등록된 플레이스인지 찾아 주기 ── */
  let spaces = [];
  try { spaces = (await H.loadSpaces()).spaces; } catch { /* 목록을 못 불러와도 신청은 됩니다 */ }

  let tm;
  nameInput.addEventListener('input', () => {
    clearTimeout(tm);
    tm = setTimeout(() => {
      idInput.value = '';
      const q = nameInput.value.trim();
      if (q.length < 2 || !spaces.length) { matchEl.textContent = ''; return; }
      const hit = spaces.filter((s) => s.kind === 'place' && s.name.includes(q)).slice(0, 3);
      if (!hit.length) { matchEl.innerHTML = '<span class="muted">혼플에 아직 없는 곳 같습니다. 신청해 주시면 확인 후 새로 등록해 드립니다.</span>'; return; }
      matchEl.innerHTML = '이 곳인가요? ' + hit.map((s) =>
        `<button type="button" class="chip sm" data-pick="${H.esc(s.id)}">${H.esc(s.name)} <span class="muted">${H.esc(s.area)}</span></button>`
      ).join(' ');
    }, 250);
  });

  matchEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const s = spaces.find((x) => x.id === b.dataset.pick);
    if (!s) return;
    idInput.value = s.id;
    nameInput.value = s.name;
    const cat = form.querySelector('[name=cat]');
    const area = form.querySelector('[name=area]');
    const addr = form.querySelector('[name=addr]');
    if (cat && s.cat) cat.value = s.cat;
    if (area && !area.value) area.value = s.area || '';
    if (addr && !addr.value) addr.value = s.addr || '';
    matchEl.innerHTML = `<span class="ok-line">‘${H.esc(s.name)}’ 페이지와 연결해서 접수합니다.</span> <button type="button" class="link-btn" data-clear>해제</button>`;
  });

  matchEl.addEventListener('click', (e) => {
    if (!e.target.closest('[data-clear]')) return;
    idInput.value = '';
    matchEl.textContent = '';
  });

  /* ── 제출 ── */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.add('hide');

    const agree = form.querySelector('[data-agree]');
    if (!agree.checked) {
      errEl.textContent = '개인정보 수집·이용 동의가 필요합니다.';
      errEl.classList.remove('hide');
      return;
    }

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = '보내는 중';

    const data = Object.fromEntries(new FormData(form).entries());
    delete data.space_q;

    try {
      const live = await H.api.ready();
      if (live) {
        const r = await fetch('/api/host', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || '신청을 보내지 못했습니다');
      } else {
        const q = JSON.parse(localStorage.getItem('hp_hosts') || '[]');
        q.push(Object.assign({ created_at: new Date().toISOString() }, data));
        localStorage.setItem('hp_hosts', JSON.stringify(q));
        H.qs('[data-done-demo]')?.classList.remove('hide');
      }
      form.classList.add('hide');
      done.classList.remove('hide');
      done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hide');
      btn.disabled = false;
      btn.textContent = '신청 보내기';
    }
  });
})();
