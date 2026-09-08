import { json, bad } from '../../_util.js';
export async function onRequestGet({ params, env }) {
  if (!env.DB) return json({ ready: false }, 503);
  const p = await env.DB.prepare(`SELECT id, category, nickname, body, space_id, space_name, metoo, thanks, going, comments, created_at FROM posts WHERE id = ? AND hidden = 0`).bind(params.id).first();
  if (!p) return bad('글을 찾을 수 없습니다', 404);
  const { results } = await env.DB.prepare(`SELECT id, nickname, body, created_at FROM comments WHERE post_id = ? AND hidden = 0 ORDER BY created_at ASC`).bind(params.id).all();
  return json({ post: { ...p, replies: results } });
}
