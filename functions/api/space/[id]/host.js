/* 공개 — 어떤 공간의 인증 호스트 안내
   GET /api/space/:id/host
   인증된 호스트가 있고 안내를 써 두었으면 그 내용을, 없으면 { host: null } 을 돌려줍니다.
   담당자 이름·연락처·사업자번호 같은 개인정보는 내보내지 않습니다. */
import { json } from '../../_util.js';

export async function onRequestGet({ params, env }) {
  if (!env.DB) return json({ host: null });
  let h = null;
  try {
    h = await env.DB.prepare(
      `SELECT pub_title, pub_note, pub_seats, pub_hours, pub_link, pub_updated_at, verified_at
         FROM hosts WHERE space_id = ? AND status = 'verified' AND pub_note IS NOT NULL AND pub_note != ''
        ORDER BY verified_at DESC LIMIT 1`
    ).bind(params.id).first();
  } catch { /* 마이그레이션 전 */ }
  if (!h) return json({ host: null });
  return new Response(JSON.stringify({
    host: {
      title: h.pub_title || '운영자가 직접 쓴 안내',
      note: h.pub_note,
      seats: h.pub_seats || '',
      hours: h.pub_hours || '',
      link: h.pub_link || '',
      verified: (h.verified_at || '').slice(0, 10),
      updated: (h.pub_updated_at || '').slice(0, 10)
    }
  }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
}
