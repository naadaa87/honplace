/* 혼곳 submit.js */
(async function () {
  const form = H.qs('[data-submit-form]');
  const done = H.qs('[data-submit-done]');
  const fix = H.param('fix');
  if (fix) {
    const { spaces } = await H.loadSpaces();
    const s = spaces.find((x) => x.id === fix);
    if (s) {
      H.qs('[data-form-title]').textContent = `‘${s.name}’ 정보 수정 제안`;
      H.qs('[data-form-lead]').textContent = '틀린 정보나 바뀐 규칙을 알려 주세요. 확인 후 반영합니다.';
      form.name.value = s.name; form.area.value = s.area; form.cat.value = s.cat;
      form.fix_id.value = s.id;
      H.qsa('[data-hide-on-fix]').forEach((el) => el.classList.add('hide'));
    }
  }

  // 세그먼트 버튼 (혼자 지수·대화 온도)
  H.qsa('.seg', form).forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const c = e.target.closest('.chip'); if (!c) return;
      H.qsa('.chip', seg).forEach((x) => x.setAttribute('aria-pressed', 'false'));
      c.setAttribute('aria-pressed', 'true');
      seg.querySelector('input[type=hidden]').value = c.dataset.v;
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name.trim() || !data.note.trim()) { H.toast('이름과 내용은 꼭 적어 주세요'); return; }
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const r = await H.api.submitSpace(data);
      form.classList.add('hide');
      done.classList.remove('hide');
      if (r.demo) H.qs('[data-done-demo]').classList.remove('hide');
    } catch (err) { H.toast(err.message || '보내지 못했어요'); btn.disabled = false; }
  });
})();
