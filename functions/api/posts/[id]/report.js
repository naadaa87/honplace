import { json, bad } from '../../_util.js';
const HIDE_AT = 3; // 신고 3건이 쌓이면 자동으로 숨김. 운영자가 /api/admin 에서 확인
export async function onRequestPost({ params, env }) {
  if (!env.DB) return bad('데이터베이스가 아직 연결되지 않았습니다', 503);
  await env.DB.prepare(`UPDATE posts SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= ? THEN 1 ELSE hidden END WHERE id = ?`).bind(HIDE_AT, params.id).run();
  return json({ ok: true });
}
