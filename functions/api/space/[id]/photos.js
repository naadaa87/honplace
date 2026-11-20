/* 한 지점의 사진 목록 (공개)
   GET /api/space/<id>/photos → { photos: [{ id, src, thumb, w, h, alt, credit, license, source, by }] } */
import { json } from '../../_util.js';
import { COLS, toPublic, SPACE_ID } from '../../_photos.js';

export async function onRequestGet({ params, env }) {
  if (!env.DB) return json({ ready: false, photos: [] }, 503);
  if (!SPACE_ID.test(params.id || '')) return json({ photos: [] });
  try {
    const { results } = await env.DB.prepare(
      `SELECT ${COLS} FROM photos WHERE space_id = ? AND hidden = 0 ORDER BY sort ASC, created_at ASC LIMIT 40`
    ).bind(params.id).all();
    return json({ ready: true, photos: results.map(toPublic) }, 200, { 'Cache-Control': 'public, max-age=60' });
  } catch {
    return json({ ready: false, photos: [] }, 503);
  }
}
