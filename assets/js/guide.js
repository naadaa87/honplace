/* 혼곳 guide.js */
(async function () {
  const { groups, guides } = await H.loadGuides();
  await H.loadSpaces();
  const id = H.param('id');
  const listEl = H.qs('[data-guide-list]');
  const artEl = H.qs('[data-guide-article]');

  if (!id) {
    listEl.innerHTML = groups.map((g) => {
      const items = guides.filter((x) => x.group === g.id);
      return `<section class="g-group"><h3>${H.esc(g.label)}</h3><div class="gtoc">${items.map((x) => `<a class="gi" href="/guide.html?id=${x.id}"><span class="l1"><span class="t">${H.esc(x.title)}</span><span class="lead-line"></span><span class="m">${x.minutes}분</span></span><span class="sub">${H.esc(x.lead)}</span></a>`).join('')}</div></section>`;
    }).join('');
    return;
  }

  const g = guides.find((x) => x.id === id);
  H.qs('[data-guide-head]').classList.add('hide');
  listEl.classList.add('hide');
  if (!g) { artEl.innerHTML = `<div class="nf"><h1>이 글은 아직 없어요.</h1><a class="btn" href="/guide.html">혼자 하는 법으로</a></div>`; return; }
  document.title = `${g.title} — 혼곳`;
  H.qs('meta[name=description]')?.setAttribute('content', g.lead);
  const grp = groups.find((x) => x.id === g.group);
  const body = g.blocks.map((b) => {
    if (b.t === 'h') return `<h2>${H.esc(b.x)}</h2>`;
    if (b.t === 'p') return `<p>${H.esc(b.x)}</p>`;
    if (b.t === 'quote') return `<blockquote>${H.esc(b.x)}</blockquote>`;
    if (b.t === 'ul') return `<ul>${b.items.map((i) => `<li>${H.esc(i)}</li>`).join('')}</ul>`;
    return '';
  }).join('');
  const catLink = g.cat ? `<a class="btn ghost sm" href="/spaces.html?cat=${g.cat}">${H.esc(H.CATS[g.cat]?.label || '')} 공간 보기</a>` : '';
  artEl.innerHTML = `<article class="article wrap read">
    <div class="kicker">${H.esc(grp?.label || '')}<span style="margin-left:12px">${g.minutes}분 읽기</span></div>
    <h1>${H.esc(g.title)}</h1>
    <p class="lead">${H.esc(g.lead)}</p>
    ${body}
    <div class="end">${catLink}<a class="btn ghost sm" href="/board.html">이름 없이 이야기 남기기</a><a class="btn ghost sm" href="/guide.html">다른 글 보기</a></div>
  </article>`;
})();
