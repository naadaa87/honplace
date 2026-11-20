/* 올린 사진 내보내기
   GET /api/photo/<id>        본문 (긴 변 1600px 안팎)
   GET /api/photo/<id>?s=t    작은 그림 (카드용)
   숨기거나 지운 사진이 오래 남지 않도록 하루만 캐시합니다. */
export async function onRequestGet({ params, request, env, waitUntil }) {
  if (!env.DB) return new Response(null, { status: 503 });
  if (!/^ph-[a-z0-9]{6,40}$/i.test(params.id || '')) return new Response(null, { status: 404 });
  const thumb = new URL(request.url).searchParams.get('s') === 't';
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  if (cache) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  let row;
  try {
    row = await env.DB.prepare(`SELECT ${thumb ? 'thumb' : 'data'} AS b, mime FROM photos WHERE id = ? AND hidden = 0 AND kind = 'upload'`).bind(params.id).first();
  } catch { return new Response(null, { status: 503 }); }
  if (!row || !row.b) return new Response(null, { status: 404 });

  const bin = Uint8Array.from(atob(row.b), (c) => c.charCodeAt(0));
  const res = new Response(bin, {
    headers: {
      'Content-Type': row.mime || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    }
  });
  if (cache && waitUntil) waitUntil(cache.put(request, res.clone()));
  return res;
}
