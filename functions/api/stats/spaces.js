/* 공개 통계 — 최근 N일 동안 후기가 달린 플레이스
   GET /api/stats/spaces?days=7
   게시판의 '이번 주 다녀온 곳' 띠에 씁니다. 글 내용은 내보내지 않고 수만 셉니다. */
import { json } from '../_util.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ ready: false, spaces: [] }, 503);
  const u = new URL(request.url);
  const days = Math.min(Math.max(parseInt(u.searchParams.get('days') || '7', 10) || 7, 1), 30);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT space_id, space_name, COUNT(*) AS n, SUM(going) AS going
       FROM posts
      WHERE hidden = 0 AND space_id IS NOT NULL AND space_id <> '' AND created_at >= ?
      GROUP BY space_id ORDER BY n DESC, going DESC LIMIT 10`
  ).bind(since).all();
  return json({ ready: true, days, spaces: results }, 200, { 'Cache-Control': 'public, max-age=300' });
}
