/* 대표 사진 모음 — 카드 목록이 한 번에 읽어 갑니다
   GET /api/photos/covers → { covers: { <space_id>: <작은 그림 주소> } }
   관리자·호스트가 올린 사진이 있는 지점만 들어 있습니다. */
import { json } from '../_util.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ ready: false, covers: {} }, 503);
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, space_id, kind, url, thumb_url FROM photos WHERE hidden = 0 ORDER BY sort ASC, created_at ASC`
    ).all();
    const covers = {};
    for (const r of results) {
      if (covers[r.space_id]) continue;
      covers[r.space_id] = r.kind === 'url' ? (r.thumb_url || r.url) : `/api/photo/${r.id}?s=t`;
    }
    return json({ ready: true, covers }, 200, { 'Cache-Control': 'public, max-age=300' });
  } catch {
    return json({ ready: false, covers: {} }, 503);
  }
}
