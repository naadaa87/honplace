/* 호스트센터 — 내 정보와 통계
   GET /api/host/me   (Authorization: Bearer <host_key>)
   인증된 호스트의 공간 정보, 공개 안내, 후기 통계를 돌려줍니다. */
import { json, bad } from '../_util.js';
import { hostFromRequest } from './_auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return bad('데이터베이스가 연결되지 않았습니다', 503);
  const h = await hostFromRequest(request, env);
  if (!h) return bad('호스트 키가 맞지 않거나 아직 인증되지 않았습니다', 401);

  /* 통계 — 이 공간에 달린 후기와 반응 */
  let stats = { posts: 0, reactions: 0, replies: 0, hostReplies: 0, last: null };
  if (h.space_id) {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM(metoo + thanks + going), 0) AS reactions,
              COALESCE(SUM(comments), 0) AS replies,
              MAX(created_at) AS last
         FROM posts WHERE space_id = ? AND hidden = 0`
    ).bind(h.space_id).first();
    const hr = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM comments c
         JOIN posts p ON p.id = c.post_id
        WHERE p.space_id = ? AND c.is_host = 1 AND c.hidden = 0`
    ).bind(h.space_id).first().catch(() => ({ n: 0 }));
    stats = {
      posts: r?.n || 0,
      reactions: r?.reactions || 0,
      replies: r?.replies || 0,
      hostReplies: hr?.n || 0,
      last: r?.last || null
    };
  }

  /* 호스트에게 돌려줄 때는 민감한 열을 뺍니다 (키·사업자번호·IP 해시는 애초에 SELECT 하지 않음) */
  return json({
    host: {
      id: h.id,
      space_id: h.space_id,
      space_name: h.space_name,
      cat: h.cat,
      area: h.area,
      addr: h.addr,
      owner_name: h.owner_name,
      email: h.email,
      verified_at: h.verified_at,
      pub: {
        title: h.pub_title || '',
        note: h.pub_note || '',
        seats: h.pub_seats || '',
        hours: h.pub_hours || '',
        link: h.pub_link || '',
        updated_at: h.pub_updated_at || null
      }
    },
    stats
  });
}
