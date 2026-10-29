/* 혼플 test.js — 혼자력 테스트
   질문은 html 에 이미 있고(검색엔진용), 여기서는 한 문항씩 보여 주고 점수를 더해 결과 페이지로 보냅니다.
   채점표는 data/test.json 을 불러와 씁니다. */
(async function () {
  /* ── 결과 페이지: 공유 버튼만 ─────────── */
  const res = H.qs('[data-test-result]');
  if (res) {
    const url = location.origin + location.pathname;
    const name = H.qs('.tr-name')?.textContent || '';
    const title = `혼자력 테스트 결과: ${name} — 혼플`;
    const share = H.qs('[data-share]', res);
    const copy = H.qs('[data-copy]', res);
    if (share) {
      if (!navigator.share) share.classList.add('hide');
      share.onclick = () => navigator.share({ title, text: H.qs('.tr-line')?.textContent || title, url }).catch(() => {});
    }
    if (copy) copy.onclick = () => navigator.clipboard.writeText(url).then(() => H.toast('링크를 복사했습니다')).catch(() => H.toast('복사에 실패했습니다'));
    /* 방금 테스트를 마친 사람이면 '내 결과' 표시 */
    try {
      const mine = localStorage.getItem('hp_test_result');
      if (mine === res.dataset.testResult) H.qs('.tr-head .cat').insertAdjacentHTML('beforeend', ' <span class="tag">내 결과</span>');
    } catch { /* */ }
    return;
  }

  /* ── 질문 페이지 ─────────────────────── */
  const root = H.qs('[data-test]');
  if (!root) return;
  const form = H.qs('[data-test-form]', root);
  const qs = H.qsa('.tq-q', form);
  const prev = H.qs('[data-prev]', form);
  const next = H.qs('[data-next]', form);
  const finish = H.qs('[data-finish]', form);
  const bar = H.qs('[data-progress]', root);
  let cur = 0;
  let data = null;

  fetch('/data/test.json', { cache: 'no-cache' }).then((r) => r.json()).then((j) => (data = j)).catch(() => {});

  function show(i) {
    cur = Math.max(0, Math.min(qs.length - 1, i));
    qs.forEach((q, k) => q.classList.toggle('on', k === cur));
    prev.disabled = cur === 0;
    const last = cur === qs.length - 1;
    next.classList.toggle('hide', last);
    finish.classList.toggle('hide', !last);
    bar.style.width = Math.round(((cur) / qs.length) * 100) + '%';
    const picked = form.querySelector(`input[name="q${cur}"]:checked`);
    next.disabled = !picked; finish.disabled = !picked;
    qs[cur].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('change', (e) => {
    if (e.target.name !== `q${cur}`) return;
    next.disabled = false; finish.disabled = false;
    /* 고르면 잠깐 뒤 자동으로 다음 문항 */
    if (cur < qs.length - 1) setTimeout(() => show(cur + 1), 260);
  });
  prev.onclick = () => show(cur - 1);
  next.onclick = () => show(cur + 1);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!data) { H.toast('잠시 후 다시 눌러 주세요'); return; }
    const score = {};
    Object.keys(data.types).forEach((k) => (score[k] = 0));
    qs.forEach((q, i) => {
      const v = form.querySelector(`input[name="q${i}"]:checked`);
      if (!v) return;
      const s = data.questions[i]?.a[+v.value]?.s || {};
      Object.entries(s).forEach(([k, n]) => (score[k] = (score[k] || 0) + n));
    });
    /* 동점이면 A→E 순서가 아니라 ‘더 분명한 쪽’을 우선: B·E 같은 끝쪽 유형이 동점이면 C(중간)를 택합니다 */
    const order = ['C', 'D', 'B', 'A', 'E'];
    const best = Object.keys(score).sort((a, b) => score[b] - score[a] || order.indexOf(a) - order.indexOf(b))[0];
    const t = data.types[best];
    try { localStorage.setItem('hp_test_result', t.id); } catch { /* */ }
    bar.style.width = '100%';
    location.href = `/test/result/${t.id}`;
  });

  qs.forEach((q) => q.classList.remove('on'));
  show(0);
  root.classList.add('ready');
})();
